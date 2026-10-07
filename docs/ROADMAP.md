# Roadmap

Each phase ends with: green tests, updated `CLAUDE.md` (Progress) and this file, a French summary
for the maintainer. Admin screens are built **in the phase of the feature they manage**.

## Open questions

_None._

## Answered (2026-10-07)

Name GachAnime · AGPL-3.0 · Common rarity confirmed · free charge cap 15 (upgrades later) ·
divine content/price OK, no Divine card rarity · no guaranteed slot · packs: free = choose pack,
paid = tier × pack with +20 % surcharge, admin pack editor by category · last copy tradable/sellable
with warning, wiki stays unlocked · series = AniList franchise (seasons + movies merged), all
characters imported, top 500 + manual AniList additions + manual series (games) · favourites
thresholds OK · no anti-multi-account protection (friends) · Discord-only sign-in ·
missions/achievements reward gems only (no booster rewards) · characters without an AniList image
are not imported · catalog completion achievements use % tiers (10/25/50/75) instead of 100 %.

## Phase 0 — Foundations ✅ (2026-10-07)

- [x] pnpm workspace, Turborepo, shared tsconfig/eslint/prettier (`packages/config`)
- [x] `packages/shared`, `packages/db` (Drizzle client, first migration: auth + player_profiles + settings + admin_audit_log)
- [x] `packages/core` (player profiles, admin promotion, audit log helper)
- [x] `apps/api` Next.js (route handlers only, standalone output), health endpoint, error format, pino
- [x] Better Auth: Discord OAuth only, admin plugin, `ADMIN_DISCORD_IDS` bootstrap + `admin:promote` CLI
- [x] Redis + rate limiting helper, idempotency-key helper (idempotency gets integration tests in Phase 2, its first user)
- [x] `apps/web` Vue + Vite + Router + Pinia + Vue Query + Tailwind + Reka UI, layout, Discord sign-in
- [x] vue-i18n (en/fr), language switcher, detection + profile persistence, `pnpm i18n:check`, eslint no-raw-text / no-missing-keys
- [x] `apps/worker` skeleton with BullMQ
- [x] Docker: one multi-target Dockerfile, `docker-compose.yml` (web/caddy, api, worker, migrate, postgres, redis), `docker-compose.dev.yml`, `.env.example`
- [x] CI (GitHub Actions): format, lint, typecheck, i18n, unit + DB integration tests, build, e2e, docker builds (not run yet: no remote)
- [x] README (self-hosting, image rights notice), LICENSE (AGPL-3.0)

## Phase 1 — Catalog & AniList import ✅ (2026-10-07)

- [x] Schema: series, media, anilist_tags, media_tags, characters, character_media, series_characters, rarities, import_jobs (+ pg_trgm search, `drawable_characters` view)
- [x] AniList client (Zod-validated queries, throttling from the announced rate limit, 429/5xx retries), pagination
- [x] Import pipeline: top-N (default 500) by popularity or explicit ids, isAdult and music videos excluded, franchise expansion and grouping (seasons + movies), all character roles except characters without an image, upserts, resumable
- [x] Gender mapping, default rarity from favourites thresholds (respect overrides)
- [x] CLI `import:anilist` + worker job (requeued after a restart) + `import_jobs` progress, cancel/resume
- [x] Admin: series list (toggle active, delete, merge/split), AniList search & import, character rarity/gender edit, unclassified list, rarity distribution
- [x] Manual series & characters (games): admin forms, image upload (sharp → WebP, `uploads` volume), JSON roster import
- [x] Admin audit log (generic helper used by all later phases) + audit log page
- [x] Tests: mapping, rarity computation, franchise grouping, client throttling, idempotent re-import, resume, admin services

## Phase 2 — Core loop: free boosters, collection, wiki ✅ (2026-10-07)

- [x] `packages/game`: rate math, weighted draw with Rng (+ empty-rarity fallback), timer arithmetic + **statistical test** (200 000 boosters, 5σ)
- [x] Schema: booster_tiers, booster_openings(+cards), user_cards, gem_transactions, free timer anchor; seed (free tier)
- [x] `openBoosters` service (x1/x5/x10, one transaction, profile row locked), boosters endpoint with free timer (cap 15), Idempotency-Key on openings
- [x] Booster opening scene with Motion (pack tear, card flips, rarity glow and burst, skip / reveal all, summary, reduced motion)
- [x] Collection page (grid, search, rarity, duplicates, sort), wiki pages (series progress, masked locked entries, spoilers, AniList credit)
- [x] Integration tests: concurrency (parallel openings never exceed charges), collection and wiki rules
- [x] E2E: sign up → open free booster → see card in collection and wiki (full stack, ADR-023)

## Phase 3 — Economy ✅ (2026-10-07)

- [x] Paid boosters (Epic / Legendary / Mythic / Divine), shop section, gem balance & history
- [x] Recycling (single, bulk with rarity filter + preview + confirmation checked against the preview)
- [x] Wishlist; collection: owned/missing/all, wishlist and duplicate filters, multi-key sort, series progress page
- [x] Admin: settings (timer, daily reset), rarities (names, thresholds with recompute, recycle values, market bounds), tiers editor (rates sum check, odds preview, prices)
- [x] Economy simulation script (`pnpm economy:simulate`, real catalog)
- [x] Tests: ledger invariant, recycle never touches first copy / locked copies, concurrent purchases never overspend
- [x] `pnpm admin:grant-gems` (audited admin adjustment, for testing and events)

## Phase 4 — Missions, achievements, feedback ✅ (2026-10-07)

- [x] Event emitter + progression engine (`emitEvents` in the caller's transaction), metric registry, user_counters (backfilled from past openings)
- [x] Missions (daily periods from the reset hour/time zone, once, per-subject dedup), claim flow; achievements with sticky completion, claim flow
- [x] Worker job `progression.recompute` (debounced) after admin catalog changes and completed imports
- [x] ~~Feedback form~~ (built, then removed by decision on 2026-10-07)
- [x] Admin: missions & achievements editors with translations (metric params validated against the registry)
- [x] UI: missions page (reset countdown), achievements page (filters, counter, progress bars), toasts, nav badges
- [x] Tests: period keys across DST, each seeded mission/achievement, engine and claim flows, e2e

## Phase 5 — Themed boosters ✅ (2026-10-07)

- [x] Themes schema + rule evaluation (compiled to SQL) + materialized pools (rebuilt on save, after imports and catalog changes, built lazily when missing)
- [x] Empty-rarity fallback in draw
- [x] Admin **pack editor**: categories, recursive rule builder, free/paid toggles, surcharge, live preview (count per rarity, sample characters, empty-rarity warnings)
- [x] Seed packs: Shōnen, Shōjo, Seinen, Sports, Ecchi, Waifus, Husbandos
- [x] Shop: pack selection for free and paid tiers (paid: +surcharge, prices from the server)
- [x] Collection filter by pack

## Phase 6 — Social: profiles, trades, market

- [ ] Public profile (collection, achievements)
- [ ] Trades: propose, counter, accept (atomic), decline, cancel, optional expiry, locks; last-copy warning
- [ ] Market: list, browse (filters, wishlist highlight), buy (atomic), withdraw, expiry, limits
- [ ] Admin: market limits settings, users (role, ban)
- [ ] Integration tests: double-buy race, trade with vanished card, deadlock-free ordering
- [ ] E2E: full trade between two users; market sale

## Phase 7 — Hardening & release 1.0

- [ ] Rate limits review on all sensitive routes, security headers, abuse tests
- [ ] Optional local image cache (worker + Caddy)
- [ ] Performance pass (indexes, pool caching), accessibility pass, mobile layout
- [ ] Complete e2e suite on critical paths; backup/restore docs
- [ ] Self-hosting guide, upgrade guide, v1.0.0 tag

## Later (not scheduled)

- [ ] Upgrades raising the free booster cap per player.
