# Architecture

## Overview

```
                    ┌──────────────────────────────────────────────────────┐
 Browser ──HTTPS──▶ │ caddy (web container)                                │
                    │  /            → static Vue SPA (apps/web build)      │
                    │  /api/*       → reverse proxy to api:3000            │
                    │  /media/*     → uploads + cached images volume       │
                    └───────────────┬──────────────────────────────────────┘
                                    │
                         ┌──────────▼──────────┐        ┌───────────────────┐
                         │ api (Next.js)        │        │ worker (Node)     │
                         │ route handlers only  │        │ BullMQ consumers  │
                         │ Better Auth          │        │ + repeatable jobs │
                         │ rate limiting        │        │                   │
                         └───┬────────────┬─────┘        └───┬──────────┬────┘
                             │ packages/core (services)      │          │
                             │            │                  │          │ AniList GraphQL
                       ┌─────▼────┐  ┌────▼────┐◀────────────┘          ▼ (rate limited)
                       │ postgres │  │  redis  │                 graphql.anilist.co
                       └──────────┘  └─────────┘
```

Same origin for SPA and API (Caddy reverse proxy) → auth cookies are first-party, no CORS setup.

## Services

| Service    | Role                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web`      | Caddy serving the built SPA, proxying `/api`, serving cached images.                                                                                |
| `api`      | Next.js App Router, **route handlers only** (`output: "standalone"`). Stateless.                                                                    |
| `worker`   | Long-running jobs: AniList import, image caching, achievement recomputation after catalog changes, theme pool rebuild, listing/trade expiry sweeps. |
| `postgres` | Single source of truth for every game state.                                                                                                        |
| `redis`    | Rate limiter counters, Better Auth secondary storage (session cache), BullMQ queues.                                                                |

A one-shot `migrate` step runs `drizzle-kit migrate` + idempotent seed before `api` starts
(compose `depends_on: condition: service_completed_successfully`).

## Package responsibilities

```
@app/shared   Zod schemas (requests, responses, settings, localized text), enums, error codes.
@app/game     Pure functions, no I/O, 100% unit-tested:
              - rate math (per-booster ↔ per-card conversion), weighted draw with injectable Rng
              - free booster timer arithmetic
              - mission period keys (reset hour + timezone)
              - metric definitions (which events affect which metric) and objective evaluation
              - theme rule evaluation, rarity-from-favourites
@app/db       Drizzle schema, relations, migrations, seed data, connection factory.
@app/core     Application services. One function = one use case = one transaction:
              openBoosters, recycleCards, recycleAllDuplicates, proposeTrade, counterTrade,
              acceptTrade, createListing, buyListing, withdrawListing, claimMission,
              claimAchievement, admin.* …
              Emits domain events to the progression engine inside the same transaction.
@app/importer AniList client (queries validated with Zod, serialized requests spaced after the
              rate limit AniList announces, 429/Retry-After and 5xx handling), resumable
              upsert pipeline, CLI entry point. Also invoked by the worker.
```

`apps/api` is a thin HTTP layer: auth/session → role check → rate limit → Zod parse →
`core` service → DTO. `apps/worker` is a thin job layer over the same services.

## Key data flows

### Opening boosters (x1 / x5 / x10)

```
POST /api/v1/boosters/open { tier: key, themeId?: id (Phase 5), quantity: 1|5|10 }  + Idempotency-Key
 1. rate limit (per user) → validate
 2. BEGIN
 3. SELECT player_profiles … FOR UPDATE
 4. free booster: compute available charges from anchor timestamp (game.timer) → reject if < quantity
    paid booster: check gem balance ≥ tier price × quantity (packs: free boosters only)
 5. load pool ids per rarity (theme pool or full catalog, active characters only), from the
    per-process cache keyed by catalog_state.version (ADR-024)
 6. draw quantity × 5 cards with crypto Rng (game.draw), apply empty-rarity fallback
 7. upsert user_cards (quantity += n), mark is_new for first discovery
 8. debit gems (+ gem_transactions) or advance free anchor
 9. insert booster_openings + booster_opening_cards
10. emit events: booster_opened(n, type), card_obtained(rarity, isNew)…
    → progression engine updates user_counters, user_missions, user_achievements
11. COMMIT → return cards (+ newly completed missions/achievements for toasts)
```

The client receives the full result at once and plays the reveal animation; nothing is decided
client-side.

### Trade acceptance

```
BEGIN
 lock both player_profiles FOR UPDATE ordered by user id
 UPDATE trades SET status='accepted' WHERE id=$1 AND status='pending' AND recipient_id=$me  (0 rows → TRADE_NOT_PENDING)
 for proposer items: quantity -= n, locked_quantity -= n (they were locked at proposal)
 for recipient items: conditional decrement WHERE quantity - locked_quantity >= n
   (0 rows → ROLLBACK, trade marked 'failed', CARD_UNAVAILABLE)
 credit received cards to each side
 emit trade_completed ×2
COMMIT
```

### Market purchase

```
BEGIN
 UPDATE market_listings SET status='sold', buyer_id=$me … WHERE id=$1 AND status='active'
        AND expires_at > now() AND seller_id <> $me RETURNING *   (0 rows → LISTING_UNAVAILABLE)
 lock buyer + seller profiles ordered by id; check buyer gems and daily purchase limit
 move gems (2 gem_transactions), move 1 card (seller locked → buyer)
 emit card_sold (seller), card_bought (buyer)
COMMIT
```

Manual catalog (games…): admin creates series/characters directly or uploads a JSON roster;
images go to the `uploads` volume (resized with sharp) and are served by Caddy under `/media`.

### Catalog import

```
Admin UI "Import" (POST /api/v1/admin/imports) or CLI → import_jobs row (one unfinished job max)
  → BullMQ job "catalog.import" (jobId catalog-import-<id>; AniList or IGDB depending on the job
    params; the worker requeues unfinished jobs at start)
worker → importer.runImportJob, resumable phase by phase:
  1. discover   top N ids (or explicit ids) → batches of 50 media (details, tags, relations and the
                first 25 characters) → follow franchise relations breadth-first; media, tags and
                first character page are upserted as they arrive
  2. group      connected components of the relation graph; media keep an existing series, new media
                join the series of the most popular assigned media of their group, else a new series
  3. characters remaining character pages (25 per request) of every media not synced by this job;
                characters without picture skipped, rarity from favourites unless overridden,
                appearances no longer listed by AniList removed
  4. finalize   rebuild series_characters, refresh series metadata from their most popular media
```

The job row is checked between steps: an admin can cancel it, then resume it later.

### Progression engine

Domain events are plain objects emitted by services **inside the current transaction**:

```
emit(tx, userId, { type: "card_recycled", count: 3, rarity: "rare" })
  → user_counters upsert (lifetime counters, e.g. cards_recycled, cards_recycled:rare)
  → active missions with matching event_type → user_missions progress for current period
  → achievements whose metric listens to this event → recompute progress, set completed_at
```

State-based metrics (distinct characters owned, completed series…) are recomputed by query when
an affecting event happens, and in bulk by a worker job after catalog changes. See
`GAME_DESIGN.md#missions-and-achievements`.

## Security

- Server-side authority for every rule; client is display only.
- Sign-in with Discord only (Better Auth OAuth). First admins: `ADMIN_DISCORD_IDS` env var
  (promoted at sign-in) or `pnpm admin:promote`.
- Better Auth sessions (httpOnly, secure, SameSite=Lax cookies); CSRF protection by origin check
  (Better Auth `trustedOrigins` for `/api/auth`, `assertSameOrigin` in every `/api/v1` handler:
  a state-changing request whose `Origin` is not `PUBLIC_URL` gets 403) and same-origin deployment.
- Admin: role check on every `/api/v1/admin/*` handler (helper `requireAdmin`), audit log for
  every mutation. Role and ban are read from the database on every request (the session cached by
  Better Auth keeps the role it had at sign-in); banned users get `PLAYER_BANNED`.
- Rate limiting (rate-limiter-flexible + Redis), per user, with named policies
  (`apps/api/src/lib/rate-limit.ts`): default 120/min, booster opening 30/min, economy actions
  60/min, trade offers and market listings 20/min, profile 20/min, admin 300/min, AniList calls
  20/min. Better Auth limits its own endpoints per IP.
- HTTP headers (Caddy, mirrored by `vite preview` for e2e): strict CSP (`script-src 'self'`, images
  from self, AniList and Discord only), HSTS, COOP, Permissions-Policy, `X-Frame-Options: DENY`;
  API responses are `Cache-Control: no-store`; request bodies capped at 10 MB.
- Cryptographically secure randomness (`crypto.randomInt`).
- Idempotency: mutating game endpoints accept an `Idempotency-Key` header (stored 24h in Redis)
  so a double click / retry never opens or buys twice.
- Zod validation on every input; Drizzle parameterized queries only.

## Frontend structure (`apps/web`)

```
src/
  app/          router, i18n setup, query client, pinia
  locales/      en.json (reference), fr.json
  api/          typed fetch client built on @app/shared schemas
  features/
    boosters/   shop, timer, opening scene (Motion), reveal
    collection/ grid, filters, sort, series progress
    wiki/       character pages (greyed when locked)
    trades/  market/  missions/  achievements/  profile/
  admin/        lazy-loaded admin routes (guarded, server enforces anyway)
  components/   shared UI built on Reka UI + Tailwind tokens
```

Locale: detected from `navigator.languages` on first visit, stored in `localStorage`; once logged
in, the profile `locale` wins and is updated when the user changes language. Numbers and dates via
vue-i18n `n()`/`d()` (Intl).
