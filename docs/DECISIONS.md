# Architecture decision records

Project name: **GachAnime** (package scope `@gachanime/*`).

Format: context → decision → consequences. Status: Accepted / Proposed (waiting for maintainer).

## ADR-001 — Monorepo with pnpm workspaces + Turborepo (Accepted)

- **Context**: API, worker and web share schemas, types and game logic.
- **Decision**: pnpm workspaces (strict, fast, disk-efficient) + Turborepo (task graph, caching).
- **Consequences**: one `pnpm install`, `turbo run build|test|lint`; internal packages consumed as TS sources (`exports` → `src`) in dev, built for Docker.

## ADR-002 — Next.js as a pure API (Accepted, per spec)

- **Context**: spec asks for Next.js route handlers in `apps/api`, Nuxt allowed if clearly more coherent.
- **Decision**: keep Next.js. Nuxt would merge front and back into one Vue app, but the spec wants a clean SPA + API split and a separate worker anyway, so Nuxt brings no decisive gain. A minimal framework (Hono/Fastify) would be lighter for an API-only service; Next.js remains acceptable: mature, `output: "standalone"` for Docker, first-class Better Auth integration.
- **Consequences**: no React pages are used; middleware limited to cheap checks (auth/rate limit happen in handlers via helpers). Long jobs never run in Next.js (worker instead).

## ADR-003 — Drizzle ORM (Accepted)

- **Context**: need typed queries, versioned migrations, fine control over transactions, row locks and conditional updates.
- **Decision**: Drizzle ORM + drizzle-kit. SQL-first (`for("update")`, `onConflictDoUpdate`, raw SQL escape hatch), no generated client step, lightweight runtime, official Better Auth adapter.
- **Alternatives**: Prisma (excellent DX, but `SELECT … FOR UPDATE` and conditional arithmetic updates need raw SQL, heavier codegen).
- **Consequences**: Drizzle is still 0.x — pin versions, upgrade deliberately.

## ADR-004 — PostgreSQL as single source of truth; Redis for ephemeral data (Accepted)

- **Context**: timers, rate limiting, jobs, sessions.
- **Decision**: all game state (gems, cards, timers, progress) lives in Postgres. Free booster timer is a timestamp computed on read — no Redis needed. Redis is used for: rate limiting (atomic counters, sliding windows), Better Auth secondary storage (session cache), BullMQ queues, idempotency keys.
- **Consequences**: losing Redis loses nothing important (rate limit windows, cache). Postgres could do all of it (pg-boss, PG rate limiter) — Redis is kept because it is cheaper per request for rate limiting and BullMQ gives import progress reporting out of the box.

## ADR-005 — Better Auth, Discord-only sign-in (Accepted)

- **Context**: self-hosted Discord OAuth (the game is played between friends, who all use Discord), roles and bans. Email/password was dropped by the maintainer: no SMTP needed.
- **Decision**: Better Auth (MIT, actively maintained, Drizzle adapter, Discord provider, `admin` plugin with roles/ban). Lucia was deprecated in 2025 and is now a learning resource, not a library.
- **Consequences**: auth tables owned by Better Auth; game data in `player_profiles`. A Discord application (client id/secret) is required to self-host. First admins come from `ADMIN_DISCORD_IDS` or the `admin:promote` CLI.

## ADR-006 — vue-i18n (Accepted)

- **Context**: multilingual UI, Intl number/date formats, missing-key detection.
- **Decision**: vue-i18n v11 (official Intlify library, Composition API, `n()`/`d()` built on Intl, lazy-loaded locale files, precompiled messages via `@intlify/unplugin-vue-i18n`). `@intlify/eslint-plugin-vue-i18n` enforces `no-raw-text` and detects missing/unused keys; `pnpm i18n:check` also runs in CI.
- **Consequences**: adding a language = adding `locales/<lang>.json` (+ registering it in a list derived from the folder).

## ADR-007 — Localized DB content as JSONB (Accepted)

- **Context**: missions, achievements, boosters, themes, rarities need per-language names with English fallback, editable in admin.
- **Decision**: `jsonb` columns shaped `{ en: string, [locale]: string }` validated by Zod, `CHECK (col ? 'en')`. Resolution `value[locale] ?? value.en` on the server.
- **Alternatives**: per-entity translation tables (more joins, a migration-free gain only for very large content).
- **Consequences**: adding a language needs no migration; admin forms show one field per supported locale.

## ADR-008 — Inventory as stacks (Accepted)

- **Context**: cards of the same character are identical (no serial number or variant).
- **Decision**: `user_cards(user_id, character_id, quantity, locked_quantity)` with check constraints.
- **Consequences**: cheap openings and recycling; duplicates = `quantity − 1`; locks are counts. If individual cards (serials, foils) are ever wanted, a migration to instances will be needed.

## ADR-009 — Concurrency strategy (Accepted)

- **Decision**: one transaction per use case (READ COMMITTED); `SELECT … FOR UPDATE` on `player_profiles` of every involved player, **ordered by user id** (no deadlocks); state transitions as conditional updates (`WHERE status = 'active'`, `WHERE quantity - locked_quantity >= n`) checking affected row counts; DB check constraints as last line of defense; `Idempotency-Key` on mutating game endpoints.
- **Consequences**: duplication bugs become constraint violations (rollback) instead of silent corruption. Concurrency integration tests are mandatory for these services.

## ADR-010 — Event-driven progression (Accepted)

- **Decision**: services emit domain events inside their transaction; a progression engine updates lifetime counters, mission progress and achievement progress. Missions = event type + filter + target; achievements = metric key (code registry) + params + target. Admins create new missions/achievements from existing events/metrics without code.
- **Consequences**: adding a new event or metric is a code change; everything else is data. State metrics are recomputed on ownership changes and by a worker job after catalog changes; completion is sticky.

## ADR-011 — Motion for Vue instead of GSAP (Accepted)

- **Context**: polished booster animations; the project is open-source.
- **Decision**: `motion-v` (Motion for Vue, MIT): springs, sequences/timelines, layout and gesture animations, actively maintained. GSAP is free but under its own "Standard no-charge" license (not OSI-approved), which is awkward to combine with an AGPL/MIT distribution.
- **Consequences**: if a specific effect needs it later, canvas/WebGL particles can be added with a separately justified library.

## ADR-012 — Same-origin deployment behind Caddy (Accepted)

- **Decision**: the `web` container is Caddy serving the SPA and reverse-proxying `/api/*` to the API; optional automatic HTTPS when a domain is set.
- **Consequences**: first-party cookies, no CORS, one public port. Dev uses the Vite proxy for the same effect.

## ADR-013 — REST + shared Zod contracts (Accepted)

- **Decision**: versioned REST (`/api/v1`) with request/response schemas in `@app/shared`; a small typed client in `apps/web` used through TanStack Vue Query.
- **Alternatives**: tRPC/oRPC (end-to-end types but couples clients to the RPC library; REST stays easy for self-hosters and per-route rate limits).

## ADR-014 — "Series" = franchise of AniList media (Accepted)

- **Context**: AniList splits a franchise into many media (seasons, movies). The same character appears in each.
- **Decision**: import media and group them into one `series` through AniList relations (SEQUEL, PREQUEL, PARENT, SIDE_STORY, ALTERNATIVE, SUMMARY between anime media — seasons and movies merged), admin can merge/split. All characters of all roles are imported, except those without an image (AniList placeholder). `series_characters` is the canonical membership, derived from `character_media` for AniList series.
- **Consequences**: "complete a series" means the whole franchise, as players expect.

## ADR-015 — Default rarity from absolute favourites thresholds (Accepted)

- **Decision**: thresholds stored on `rarities` (`favourites_threshold`), admin overrides are sticky.
- **Consequences**: importing new series never reshuffles existing rarities.

## ADR-016 — License: AGPL-3.0 (Accepted)

- **MIT**: maximal adoption, anyone may run a closed modified fork (even a hosted commercial one).
- **AGPL-3.0**: anyone who runs a modified version **as a public service** must publish their changes; protects the community from closed hosted forks; some companies avoid AGPL.
- **Decision**: AGPL-3.0-only — a self-hostable server application whose hosted forks must stay open.

## ADR-017 — Cryptographic randomness (Accepted)

- **Decision**: `crypto.randomInt` behind an `Rng` interface; seeded PRNG only in tests.

## ADR-018 — Booster = tier × pool (Accepted)

- **Context**: every tier (Free, Epic, Legendary, Mythic, Divine) can be combined with any pack; paid themed boosters cost +20 % by default.
- **Decision**: `booster_tiers` (rates + base price) and `themes` (pool rules, category, free/paid toggles, surcharge) are independent; the shop combines them at request time. No table of every combination.
- **Consequences**: adding a pack instantly offers it in all enabled tiers. The admin "pack editor" manages packs per category.

## ADR-019 — Manual catalog source for non-AniList series (Accepted)

- **Context**: the maintainer wants to add series AniList does not cover, such as gacha games.
- **Decision**: `series.source/kind` and `characters.source`; manual series and characters are created in the admin (image upload stored in a volume, resized with sharp) or via a JSON bulk import. Rarity is set by the admin (no favourites).
- **Consequences**: an `uploads` volume is part of the deployment; the AniList credit is shown only for AniList characters.

## ADR-020 — Package manager and runtime (Accepted)

- **Decision**: Node.js 24 LTS in Docker images (local dev works on newer Node), pnpm 12 pinned through `packageManager`.

## ADR-021 — AniList client without a GraphQL toolkit (Accepted)

- **Context**: the importer sends four queries. gql.tada needs the AniList schema introspection
  file; p-queue does not know AniList's moving limit (90/min normally, 30/min currently).
- **Decision**: plain query strings, responses validated with Zod (same rule as every other
  external input); a small client serializes requests and spaces them after `X-RateLimit-Limit`,
  waits for `Retry-After` on 429 and retries 5xx with backoff.
- **Consequences**: no codegen step; a field renamed by AniList fails loudly at validation.

## ADR-022 — One integration test database per package (Accepted)

- **Context**: turbo runs package test suites in parallel; core and importer tests truncate tables.
- **Decision**: `@gachanime/db/testing` creates `<TEST_DATABASE_URL db>_<package>` on demand,
  migrates it and resets it (truncate + seed) before each test.
- **Consequences**: the test role must be allowed to create databases (true for the dev compose
  and CI Postgres users).

## ADR-023 — Full-stack e2e sign-in without Discord (Accepted)

- **Context**: player flows need a signed-in user, but Discord OAuth cannot be automated, and a
  sign-in shortcut inside the API would be a backdoor on every instance.
- **Decision**: the e2e suite creates the user and its Discord account row itself, runs the same
  profile creation as the API sign-in hook, and opens a real session with Better Auth's
  `testUtils` plugin in a **test-only** auth instance (same secret, same Redis storage layout).
  Player specs (`*.full.spec.ts`) run when `TEST_DATABASE_URL`, `REDIS_URL` and
  `BETTER_AUTH_SECRET` are set: Playwright starts an API dev server on port 3100
  (`NEXT_DIST_DIR=.next-e2e`, so it can run next to `pnpm dev`) on a dedicated `<test db>_e2e`
  database seeded with a small manual series.
- **Consequences**: no test code ships in the API; the e2e helper must follow the API's secondary
  storage key layout (`auth:<key>`).

## ADR-024 — Booster pools cached per catalog version (Accepted, revised 2026-10-08)

- **Context**: a draw picks a uniform character among the drawable characters of a rarity.
  Loading the pool from the `drawable_characters` view on every opening cost ~80 ms with a
  40 000-character catalog (top 500 scale), and catalog completion recounted the view too.
- **Decision**: a single-row `catalog_state.version` (uuid) gets a new value from
  statement-level triggers whenever drawability or a pack pool may change (characters inserted,
  deleted, activated or re-rarified; series activated or deleted; `series_characters` and
  `theme_characters` changes). Each process caches the pools, the drawable id set and the pack
  pool sizes keyed by that version (`core/catalog/drawable-pool`), and reads the version (one
  primary-key lookup) before using them.
- **Consequences**: an opening went from ~160 ms to ~40 ms on the benchmark catalog; the cache
  is never stale once a change is committed, and needs no explicit invalidation in services.
  A transaction that bumps the version and rolls back only leaves an unused cache entry.
  Unrelated character updates (images, names) keep the version. Memory: a few hundred kB.

## Main dependencies

Checked on npm on 2026-10-07 (latest version, last publish ≤ 1 month unless noted). All licenses
are MIT/Apache-2.0/ISC (compatible with MIT and AGPL-3.0).

| Package                               | Version     | License          | Purpose / why                                                                                    |
| ------------------------------------- | ----------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| turbo                                 | 2.11        | MIT              | Monorepo task runner.                                                                            |
| typescript                            | 5.x/6.x     | Apache-2.0       | Language.                                                                                        |
| next                                  | 16.4        | MIT              | API route handlers (ADR-002).                                                                    |
| drizzle-orm / drizzle-kit             | 0.45 / 0.31 | Apache-2.0 / MIT | ORM + migrations (ADR-003).                                                                      |
| pg                                    | 8.23        | MIT              | Postgres driver (best Drizzle + Better Auth compatibility).                                      |
| better-auth                           | 1.7         | MIT              | Auth, Discord OAuth, admin plugin (ADR-005).                                                     |
| zod                                   | 4.6         | MIT              | Shared validation.                                                                               |
| ioredis                               | 6.0         | MIT              | Redis client.                                                                                    |
| rate-limiter-flexible                 | 11.2        | ISC              | Rate limiting with Redis backend.                                                                |
| bullmq                                | 6.3         | MIT              | Job queue + repeatable jobs (import, sweeps, recompute).                                         |
| pino                                  | 10.4        | MIT              | Structured logs.                                                                                 |
| (none)                                | -           | -                | AniList queries are plain GraphQL strings validated with Zod (no codegen, no gql.tada).          |
| vue                                   | 3.5         | MIT              | UI.                                                                                              |
| vite                                  | 8.3         | MIT              | Build/dev server.                                                                                |
| vue-router                            | 5.3         | MIT              | Routing.                                                                                         |
| pinia                                 | 4.0         | MIT              | Client state (session, locale, UI).                                                              |
| @tanstack/vue-query                   | 5.104       | MIT              | Server state, caching, invalidation.                                                             |
| tailwindcss                           | 4.3         | MIT              | Styling.                                                                                         |
| reka-ui                               | 2.11        | MIT              | Accessible headless components (dialogs, menus, tabs, selects).                                  |
| @vueuse/core                          | 15.0        | MIT              | Composables (timers, storage, media queries).                                                    |
| motion-v                              | 2.6         | MIT              | Animations (ADR-011).                                                                            |
| vue-i18n + @intlify/unplugin-vue-i18n | 11.4 / 11.2 | MIT              | i18n (ADR-006).                                                                                  |
| vee-validate                          | 4.15        | MIT              | Forms (accepts Zod via Standard Schema). Last release 2026-03 — acceptable, re-check at Phase 0. |
| vitest                                | 5.0         | MIT              | Unit/integration tests.                                                                          |
| @playwright/test                      | 1.63        | Apache-2.0       | E2E tests.                                                                                       |
| sharp                                 | 0.35        | Apache-2.0       | Image uploads (resize, WebP) and the optional image cache.                                       |

Rejected: `lucia` (deprecated), `gsap` (non-OSI license), `graphql-request` (no release since 2025-12),
PrimeVue (custom license file, heavier styled kit vs headless Reka UI).
