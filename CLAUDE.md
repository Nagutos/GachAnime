# CLAUDE.md — GachAnime project memory

> **GachAnime** — package scope `@gachanime/*`, license AGPL-3.0.
> The original spec (French) is `InitialPrompt.md`, kept locally and **not committed** (the repo is
> English-only); decisions taken since then are in `docs/` and override it.

## Vision

An open-source, self-hostable web game where players collect anime character cards:

- free boosters on a timer, paid boosters bought with an in-game currency (**gems**, never real money);
- a collection with rarities, duplicates, recycling, a wishlist and per-series progress;
- a wiki where each character's entry unlocks once the player obtains the card;
- player-to-player trades and a gem-based market;
- daily missions and permanent achievements;
- a full admin panel (catalog, pack editor, rates, economy, missions, achievements, users, audit log).

Audience: groups of friends on self-hosted instances. Sign-in with **Discord only**. No anti
multi-account restrictions. Catalog: AniList (top 500 franchises, all characters) + manual series
such as gacha games.

The **concept and mechanics** come from Kyara (kyara.games). The **identity does not**: name, logo,
design, colors, copy and assets must be 100% original. Never copy any asset, text or code from it.

## Language rules

- Everything in the repository is **English**: code, identifiers, comments, commits, docs, API error
  messages, logs.
- Conversations with the maintainer are in **French** (questions, summaries, proposals).
- The UI is multilingual (vue-i18n). **No hardcoded user-facing string** in components: translation
  keys only. English is the reference and fallback locale. Starting locales: `en`, `fr`.
- DB-managed content (missions, achievements, boosters, themes, rarities) stores translations as a
  localized JSONB object `{ "en": "...", "fr": "..." }` with fallback to `en`.
- AniList data (character/series names, descriptions) is displayed as provided. No machine translation.

## Stack

| Concern            | Choice                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Monorepo           | pnpm workspaces + Turborepo                                                  |
| Language           | TypeScript (strict) everywhere                                               |
| API                | Next.js (App Router) route handlers only, `apps/api`                         |
| Background jobs    | Node worker with BullMQ, `apps/worker`                                       |
| Frontend           | Vue 3 + Vite + Vue Router + Pinia + TanStack Vue Query, `apps/web`           |
| Styling / UI       | Tailwind CSS v4 + Reka UI (headless components)                              |
| Animations         | Motion for Vue (`motion-v`)                                                  |
| i18n               | vue-i18n (+ `@intlify/unplugin-vue-i18n`, `@intlify/eslint-plugin-vue-i18n`) |
| Database           | PostgreSQL 17 + Drizzle ORM + drizzle-kit migrations                         |
| Cache / RL / queue | Redis (rate limiting, auth secondary storage, BullMQ). Never game state      |
| Auth               | Better Auth (Discord OAuth only, admin plugin)                               |
| Validation         | Zod v4, shared schemas in `packages/shared`                                  |
| Tests              | Vitest (unit/integration), Playwright (e2e)                                  |
| Logs               | pino                                                                         |
| Deployment         | Docker + docker compose (caddy/web, api, worker, postgres, redis)            |
| Runtime / PM       | Node 24 LTS (Docker), pnpm 12 (`packageManager`)                             |

Rationale for each choice: `docs/DECISIONS.md`.

## Repository layout (target)

```
apps/
  api/        Next.js route handlers under /api/v1, Better Auth under /api/auth
  worker/     BullMQ worker: AniList import, image cache, recomputations, sweeps
  web/        Vue SPA (player area + lazy-loaded /admin area)
packages/
  shared/     Zod schemas, DTO types, enums, error codes, settings schema
  db/         Drizzle schema, migrations, seed, db client
  game/       PURE game logic (no I/O): draw, rate math, timers, economy, metrics
  core/       Application services (transactions): boosters, recycling, trades, market,
              progression, admin. Used by api + worker
  importer/   AniList GraphQL client + import pipeline (CLI + worker job)
  config/     Shared tsconfig / eslint / prettier presets
e2e/          Playwright tests
docker/       Dockerfiles, Caddyfile
docs/         Architecture, game design, database, roadmap, decisions
scripts/      Repo scripts (i18n key check, etc.)
```

Dependency direction: `apps/*` → `core` → (`game`, `db`, `shared`); `game` depends only on `shared`.
`web` depends only on `shared`. Never import `db`/`core` from `web`. All packages are named
`@gachanime/<dir>`.

## Conventions

- TypeScript `strict`, `noUncheckedIndexedAccess`. No `any` (use `unknown` + Zod parsing).
- ESM everywhere. Named exports. File names `kebab-case.ts`, Vue components `PascalCase.vue`.
- Every API input is parsed with a Zod schema from `@app/shared`; every response has a typed DTO.
- API errors: `{ error: { code: "SNAKE_CASE_CODE", message: "English message" } }`. The web app
  translates `code` via i18n (`errors.<code>`), never displays `message` directly.
- **Any operation that touches inventory or gems runs inside one DB transaction** in `packages/core`,
  locking the affected `player_profiles` rows with `SELECT … FOR UPDATE` (multiple users: ordered by
  id to avoid deadlocks) and using conditional updates (`WHERE quantity - locked_quantity >= n`).
- Every gem balance change writes a `gem_transactions` row in the same transaction.
- Randomness for game outcomes: `node:crypto` (`randomInt`) only, through an injectable `Rng`
  interface so tests can use a seeded generator.
- No game rule is computed client-side. The client only displays server results.
- Tunable values live in DB (`settings`, `rate_tables`, `rarities`, …), never as code constants
  (code holds only defaults used by the seed).
- Admin routes check the role server-side and write `admin_audit_log` for every mutation.
- Commits: Conventional Commits, small and explicit (`feat(api): …`, `fix(web): …`, `docs: …`).
- Tests: pure logic in `packages/game` is unit-tested; services in `packages/core` get
  integration tests against a real Postgres (testcontainers or the compose db).

## Commands

```bash
pnpm install
cp .env.example .env     # dev: PUBLIC_URL=http://localhost:5173; fill BETTER_AUTH_SECRET + Discord app
docker compose -f docker-compose.dev.yml up -d   # postgres :5433 (db gachanime + gachanime_test), redis :6380
pnpm db:migrate          # apply migrations + idempotent seed (settings…)
pnpm dev                 # turbo: web :5173 (proxies /api), api :3000, worker
pnpm build
pnpm format:check && pnpm lint && pnpm typecheck
pnpm test                # vitest; core DB integration tests use TEST_DATABASE_URL (from .env)
pnpm test:e2e            # playwright (builds web, vite preview); player flows also start an API on :3100
pnpm i18n:check          # missing/extra translation keys between locales
pnpm db:generate         # drizzle-kit generate (new migration from schema diff)
pnpm admin:promote -- --discord-id 123456789012345678
pnpm admin:grant-gems -- --discord-id 123456789012345678 --amount 500   # audited, negative removes
pnpm economy:simulate -- --days 90 --free-per-day 25 --other-per-day 80
pnpm import:anilist -- --top 500   # or --ids 16498,1535 / --resume <job id> (also from the admin UI)
docker compose up -d     # full self-hosted stack on :8080 (needs .env)
```

Gotchas:

- pnpm 12 enforces `minimumReleaseAge`: brand-new package versions are refused; pin the previous one
  (e.g. Next.js was pinned to 16.3.x). Build scripts must be approved in `pnpm-workspace.yaml` (`allowBuilds`).
- `@gachanime/db/migrate` is a separate entry point: Next.js cannot bundle the migrations folder URL.
- Inside Docker, `tsx` is resolved per package: run tool commands from the package directory
  (`-w /app/packages/core`, etc.).
- Vitest tests reading files must use `// @vitest-environment node` in the web app (happy-dom default).
- `turbo.json` sets `agentGuidance: false` (turbo otherwise writes an AGENTS.md).
- pnpm forwards the `--` separator to scripts: CLIs parse `cliArgs()` (from `@gachanime/core`).
- In correlated subqueries written with `sql`, name outer columns explicitly (`"series"."id"`):
  Drizzle renders `${series.id}` unqualified, which silently binds to the inner table.
- vue-i18n messages are precompiled: read them with `t()`, never from the raw `messages` object.
- E2E player specs (`*.full.spec.ts`) need the dev compose up and `TEST_DATABASE_URL`, `REDIS_URL`,
  `BETTER_AUTH_SECRET`; they use the `<test db>_e2e` database. Playwright starts web servers
  before `globalSetup`, so readiness probes must not need the database.
- Gem changes go through `changeGems` (core) inside a transaction that already called `lockPlayer`:
  it writes the `gem_transactions` row; never update `gem_balance` directly.
- `.env` `PUBLIC_URL` must match the URL in the browser (dev: `http://localhost:5173`), otherwise
  Better Auth rejects sign-in with "Invalid origin".
- Any new player action that should count for missions/achievements calls `emitEvents(tx, …)`
  (core `progression/engine`) inside its transaction and returns its `ProgressionUpdate`; the
  web app shows toasts from it (`notifyProgression`). New event types go in `GAME_EVENT_TYPES`
  (shared) and the `GameEvent` union (game); the compiler checks they match.
- Game outcomes take a `GameClock` (`{ rng, now }`) in core services: tests inject `seededRng`
  and a fixed date; production uses `cryptoRng` (`@gachanime/core`).
- Uploaded images live in `UPLOADS_DIR` (default `<repo>/uploads` in dev, the `uploads` volume in
  Docker) and are served under `/media` (Caddy in production, a Vite middleware in dev).

## Architecture decisions (summary — details in docs/DECISIONS.md)

- ADR-001 pnpm + Turborepo monorepo.
- ADR-002 Next.js used as a pure API (kept as requested; Nuxt/Hono considered).
- ADR-003 Drizzle ORM.
- ADR-004 Postgres is the single source of truth; Redis only for ephemeral data and queues.
- ADR-005 Better Auth (Lucia is deprecated).
- ADR-006 vue-i18n; ADR-007 localized DB content as JSONB.
- ADR-008 Inventory stored as stacks (`quantity`, `locked_quantity`), not card instances.
- ADR-009 Concurrency: transactions + row locks + conditional updates + ordered locking.
- ADR-010 Event-driven progression with a code-side metric registry and data-defined missions/achievements.
- ADR-011 Motion for Vue instead of GSAP (license compatibility).
- ADR-012 Same-origin deployment behind Caddy.
- ADR-013 REST + shared Zod contracts.
- ADR-014 A "series" is a franchise grouping several AniList media (seasons + movies).
- ADR-015 Default rarity from absolute AniList favourites thresholds.
- ADR-016 License AGPL-3.0.
- ADR-018 Booster = tier × pool (packs), +20 % surcharge for paid themed boosters.
- ADR-019 Manual catalog source (games) with image uploads and JSON roster import.
- ADR-020 Node 24 LTS in Docker, pnpm 12.
- ADR-021 AniList client: plain GraphQL strings + Zod, own throttling (no gql.tada / p-queue).
- ADR-022 One integration test database per package (`@gachanime/db/testing`).
- ADR-023 Full-stack e2e sign-in through Better Auth `testUtils` in a test-only instance (no API backdoor).
- ADR-024 Booster pool loaded per opening from `drawable_characters` (caching deferred to Phase 7).

## Open questions (waiting for the maintainer)

Tracked in `docs/ROADMAP.md` → "Open questions". Do not implement anything depending on them
before an answer. Ask the maintainer (in French) before any architecture or gameplay change.

## Progress

- 2026-10-07 — Session 1: read spec, wrote `CLAUDE.md` and `docs/`. Maintainer answered the open
  questions (name GachAnime, AGPL, Discord only, cap 15, packs, franchises, manual game series…);
  docs updated accordingly.
- 2026-10-07 — **Phase 0 done**: monorepo, shared/db/core packages, Next.js API (health, me, Better
  Auth Discord + admin plugin + Redis storage, rate limit, idempotency helpers), BullMQ worker
  skeleton, Vue web app (Discord sign-in, i18n en/fr with detection + profile sync, Tailwind tokens),
  Docker stack verified end-to-end (`docker compose up` → healthy api/worker, Caddy serving SPA + API),
  CI workflow. Tests: 32 unit/integration (Vitest) + 4 e2e (Playwright), lint/typecheck/i18n clean.
  Not verified: a real Discord sign-in (needs a Discord application). Next: Phase 1 (catalog & AniList import).
- 2026-10-07 — Decisions: missions/achievements reward gems only; characters without an AniList
  picture are not imported; catalog completion achievements use 10/25/50/75 % tiers.
- 2026-10-07 — **Phase 1 done**: catalog schema, `packages/game` (rarity, gender), `packages/importer`
  (AniList client + resumable franchise import, CLI + worker job), admin catalog services and API,
  admin UI (overview, series, characters, imports, audit log, manual series, JSON rosters, image
  uploads). Verified against the real AniList (Attack on Titan: 15 media → 1 series, 192
  characters, 42 requests) and in a browser with a forged admin session. Next: Phase 2.
- 2026-10-07 — **Phase 2 done**: `packages/game` (seeded Rng, rate math, weighted draw with
  fallback, free timer) with a statistical test; schema for tiers, openings, user cards, gem
  ledger; `openBoosters` (one transaction, profile lock, concurrency tests), collection and wiki
  services + routes; web boosters page, Motion opening scene, collection and wiki pages; full-stack
  e2e (ADR-023). New players start with every free charge (anchor at epoch). Local `.env` had an
  empty `BETTER_AUTH_SECRET`: a random one was generated. Dev DB: top 200 AniList import. Next: Phase 3.
- 2026-10-07 — **Phase 3 done**: paid tiers (Epic/Legendary/Mythic/Divine) with gem debit and
  ledger, recycling (single + bulk checked against the confirmed preview), wishlist, collection
  ownership/wishlist filters and multi-key sort, series progress page, gem history, admin
  settings/rarities/tiers editors, `admin:grant-gems` and `economy:simulate` CLIs. Top 200 import
  done (140 series, 11 429 characters, **no Mythic**: highest favourites 39 217 < 50 000 threshold;
  maintainer to decide the threshold). Next: Phase 4.
- 2026-10-07 — **Phase 4 done**: progression engine (counters, daily/once missions with dedup,
  achievements from a code metric registry, sticky completion), claim flows, worker recompute after
  catalog changes, feedback, admin editors for missions/achievements and feedback list, missions /
  achievements / feedback pages with toasts and badges. Next: Phase 5 (themed boosters).
