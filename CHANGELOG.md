# Changelog

All notable changes are listed here. Versions follow [semantic versioning](https://semver.org).
Upgrade instructions: [docs/UPGRADING.md](docs/UPGRADING.md).

## 1.0.0 — 2026-10-08

First stable release.

### Game

- Free boosters on a timer (pack choice) and paid boosters (Epic, Legendary, Mythic, Divine) bought
  with gems, themed packs with a surcharge, animated opening.
- Collection with rarities, duplicates, recycling (single and bulk), wishlist, filters and sorts,
  per-series progress.
- Wiki: series and character pages that unlock when a card is first obtained.
- Daily and one-time missions, permanent achievements, gem rewards, toasts and badges.
- Public profiles, players directory, trades (offer, counter, accept, decline, expiry) and a gem
  market (listings, purchases, limits, price bounds, expiry).
- English and French interface.

### Administration

- AniList import (top N franchises, single anime, resumable), manual series and characters, JSON
  rosters, image uploads, series merge and split.
- Editors for rarities, booster tiers, packs (with live preview), missions, achievements, game
  settings; users (role, ban); audit log of every admin action.
- Optional local cache of catalog images.

### Operations

- Docker Compose stack (Caddy, API, worker, PostgreSQL, Redis) with automatic migrations.
- Security: Discord-only sign-in, per-player rate limits, cross-origin request rejection, strict
  Content-Security-Policy and security headers.
- Self-hosting, backup/restore and upgrade guides.
