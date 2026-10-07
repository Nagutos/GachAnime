# Roadmap

Each phase ends with: green tests, updated `CLAUDE.md` (Progress) and this file, a French summary
for the maintainer. Admin screens are built **in the phase of the feature they manage**.

## Open questions

- [ ] Divine booster as a reward (missions/achievements granting boosters instead of gems)? Currently purchase only.

## Answered (2026-10-07)

Name GachAnime · AGPL-3.0 · Common rarity confirmed · free charge cap 15 (upgrades later) ·
divine content/price OK, no Divine card rarity · no guaranteed slot · packs: free = choose pack,
paid = tier × pack with +20 % surcharge, admin pack editor by category · last copy tradable/sellable
with warning, wiki stays unlocked · series = AniList franchise (seasons + movies merged), all
characters imported, top 500 + manual AniList additions + manual series (games) · favourites
thresholds OK · no anti-multi-account protection (friends) · Discord-only sign-in.

## Phase 0 — Foundations
- [ ] pnpm workspace, Turborepo, shared tsconfig/eslint/prettier (`packages/config`)
- [ ] `packages/shared`, `packages/db` (Drizzle client, first migration: auth + player_profiles + settings)
- [ ] `apps/api` Next.js (route handlers only, standalone output), health endpoint, error format, pino
- [ ] Better Auth: Discord OAuth only, admin plugin, `ADMIN_DISCORD_IDS` bootstrap + `admin:promote` CLI
- [ ] Redis + rate limiting helper, idempotency-key helper
- [ ] `apps/web` Vue + Vite + Router + Pinia + Vue Query + Tailwind + Reka UI, layout, auth pages
- [ ] vue-i18n (en/fr), language switcher, detection + profile persistence, `pnpm i18n:check`, eslint no-raw-text
- [ ] `apps/worker` skeleton with BullMQ
- [ ] Docker: Dockerfiles, `docker-compose.yml` (web/caddy, api, worker, migrate, postgres, redis), `.env.example`
- [ ] CI (GitHub Actions): lint, typecheck, unit tests, i18n check, build
- [ ] README (self-hosting, image rights notice), LICENSE

## Phase 1 — Catalog & AniList import
- [ ] Schema: series, media, anilist_tags, media_tags, characters, character_media, series_characters, rarities
- [ ] AniList client (typed queries, throttling, 429 handling), pagination
- [ ] Import pipeline: top-N (default 500) by popularity or explicit ids, isAdult excluded, franchise expansion and grouping (seasons + movies), all character roles, upserts, resumable
- [ ] Gender mapping, default rarity from favourites thresholds (respect overrides)
- [ ] CLI `import:anilist` + worker job + `import_jobs` progress
- [ ] Admin: series list (toggle active, delete, merge/split), AniList search & import, character rarity/gender edit, unclassified list
- [ ] Manual series & characters (games): admin forms, image upload (sharp, `uploads` volume), JSON roster import
- [ ] Admin audit log (generic helper used by all later phases)
- [ ] Tests: mapping, rarity computation, idempotent re-import

## Phase 2 — Core loop: free boosters, collection, wiki
- [ ] `packages/game`: rate math, weighted draw with Rng, timer arithmetic + **statistical test**
- [ ] Schema: booster_tiers, booster_openings(+cards), user_cards, gem_transactions; seed
- [ ] `openBoosters` service (x1/x5/x10, one transaction), free timer endpoint (cap 15)
- [ ] Booster opening scene with Motion (pack tear, card flips, rarity effects, skip / reveal all)
- [ ] Collection page (grid, basic filters), wiki pages (masked when locked, AniList credit)
- [ ] Integration tests: concurrency (parallel openings never exceed charges)
- [ ] E2E: sign up → open free booster → see card in collection and wiki

## Phase 3 — Economy
- [ ] Paid boosters (Epic / Legendary / Mythic / Divine), shop page, gem balance & history
- [ ] Recycling (single, bulk with rarity filter + preview + confirmation)
- [ ] Wishlist; collection: all filters, multi-sort, series progress page
- [ ] Admin: settings (timer, recycle values), rarities, tiers editor (rates sum check, prices)
- [ ] Economy simulation script (income vs prices with real catalog)
- [ ] Tests: ledger invariant, recycle never touches first copy / locked copies

## Phase 4 — Missions, achievements, feedback
- [ ] Event emitter + progression engine, metric registry, user_counters
- [ ] Missions (daily periods, once), claim flow; achievements with sticky completion, claim flow
- [ ] Worker job: recompute state metrics after catalog changes
- [ ] Feedback form; admin feedback list
- [ ] Admin: missions & achievements editors with translations
- [ ] UI: missions panel, achievements page (filters, counter, progress bars), toasts
- [ ] Tests: period keys across DST, each seeded mission/achievement

## Phase 5 — Themed boosters
- [ ] Themes schema + rule evaluation + materialized pools (rebuild on save/import)
- [ ] Empty-rarity fallback in draw
- [ ] Admin **pack editor**: categories, rule builder, free/paid toggles, surcharge, live preview (count per rarity, warnings)
- [ ] Seed packs: Shōnen, Shōjo, Seinen, Sports, Ecchi, Waifus, Husbandos
- [ ] Shop grid tier × pack (free: choose pack; paid: +surcharge)
- [ ] Collection filter by theme

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
- [ ] Booster rewards (missions/achievements granting boosters) — pending decision.
