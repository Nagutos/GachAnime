# Game design

All numbers below are **starting values** stored in the database (seeded) and editable in the admin.
Items marked **(pending)** wait for the maintainer's confirmation.

## 1. Rarities

| Order | Key         | Default share of draws (free booster, per card) |
| ----- | ----------- | ----------------------------------------------- |
| 1     | `common`    | 52.51 %                                         |
| 2     | `rare`      | 43.22 %                                         |
| 3     | `epic`      | 3.80 %                                          |
| 4     | `legendary` | 0.40 %                                          |
| 5     | `mythic`    | 0.066 %                                         |

Rarities are rows in `rarities` (key, order, translated name, color token, recycle value, market
price bounds). The "divine" booster is a booster, not a card rarity.

### Default rarity of a character

Computed at import from AniList `favourites`, using **absolute thresholds** (stable when the
catalog grows, unlike percentiles). Admin can override per character (`rarity_overridden = true`
is never touched by re-imports).

| Rarity    | Favourites ≥ (default) |
| --------- | ---------------------- |
| Mythic    | 50 000                 |
| Legendary | 15 000                 |
| Epic      | 3 000                  |
| Rare      | 500                    |
| Common    | < 500                  |

The admin shows the resulting distribution so thresholds can be tuned after the first import.

## 2. Boosters

A booster type = **pool filter** × **rate table** (+ price).

- **Pool**: whole active catalog, or a theme (§5).
- **Rate table**: per-card weights over rarities, in parts per million (integers, sum = 1 000 000).
- **Price**: `null` = free (consumes free charges), otherwise a gem price per booster.
- Every booster contains **5 cards**. Opening by **x1, x5, x10** = one request, one transaction.

### Drawing algorithm (per card)

1. `r = crypto.randomInt(0, 1_000_000)`; walk cumulative weights → rarity.
2. Pick uniformly (`crypto.randomInt(0, n)`) among the active characters of that rarity in the pool.
3. If the pool has no character of that rarity → **fallback**: next lower rarity, then next higher
   (the admin theme screen flags empty rarities).

Cards are independent: no pity, no guaranteed slot, including in paid boosters (decided).

### Free booster: converting the target rates

The targets are "probability of at least one card of rarity X in a 5-card booster" (P).
With independent cards, `P = 1 − (1 − p)^5`, so the per-card probability is

```
p = 1 − (1 − P)^(1/5)
```

| Rarity    | Target P (≥1 per booster) | Per card p | Weight (ppm) |
| --------- | ------------------------- | ---------- | ------------ |
| Rare      | 94.1 %                    | 43.2233 %  | 432 233      |
| Epic      | 17.6 %                    | 3.7977 %   | 37 977       |
| Legendary | 2.0 %                     | 0.4032 %   | 4 032        |
| Mythic    | 0.33 %                    | 0.0661 %   | 661          |
| Common    | (remainder)               | 52.5097 %  | 525 097      |
| **Total** |                           | 100 %      | 1 000 000    |

**Statistical test** (`packages/game`): simulate 200 000 free boosters with a seeded Rng, measure
the share of boosters containing ≥1 card of each rarity, and assert it is within 5 standard
deviations of the target (binomial σ = √(P(1−P)/N); e.g. Mythic: σ ≈ 0.013 pp). A second test
checks the per-card frequencies and that weights always sum to 1 000 000.

### Free booster timer

- One free charge every **10 minutes** (`free_booster_interval_seconds = 600`).
- A new player starts with every charge available (anchor at epoch).
- Charges accumulate up to a cap of **15** (2h30), which makes x5/x10 useful for free boosters
  without rewarding 24/7 presence too much. Future: upgrades that raise the cap per player
  (not in v1 scope; the cap is read through one function so a per-player bonus can be added).
- Stored as one timestamp per player (`free_booster_anchor_at`), no cron, no Redis:

```
available = min(cap, floor((now − anchor) / interval))
on consuming n: anchor = max(anchor, now − cap × interval) + n × interval
next charge in = interval − ((now − anchor) mod interval)   (when available < cap)
```

### Paid boosters (proposal)

Rule: the booster's rarity is strongly boosted, higher rarities slightly boosted, price grows with
rarity. Per-card weights (%), and resulting "≥1 per booster" chances:

| Booster    | Price (gems) | Common | Rare  | Epic | Legendary | Mythic | ≥1 Epic+ | ≥1 Legendary+ | ≥1 Mythic |
| ---------- | ------------ | ------ | ----- | ---- | --------- | ------ | -------- | ------------- | --------- |
| Free       | 0            | 52.51  | 43.22 | 3.80 | 0.40      | 0.066  | 19.6 %   | 2.3 %         | 0.33 %    |
| Epic       | 150          | 40     | 40    | 18   | 1.6       | 0.4    | 67.2 %   | 9.6 %         | 2.0 %     |
| Legendary  | 500          | 30     | 40    | 20   | 8.5       | 1.5    | 83.2 %   | 41.0 %        | 7.3 %     |
| Mythic     | 1 500        | 20     | 40    | 25   | 10        | 5      | 92.2 %   | 55.6 %        | 22.6 %    |
| **Divine** | 5 000        | 0      | 0     | 55   | 30        | 15     | 100 %    | 95.0 %        | 55.6 %    |

- Divine: Epic or better only; opening one unlocks "Touched by the Gods". There is no "Divine"
  card rarity. Obtained by purchase only: missions and achievements reward gems only (decision).
- Every tier can be combined with a theme ("Shōnen Legendary booster"), see §5.

## 3. Economy (gems)

Gems are virtual only. **No real-money payment anywhere.** Every change is a `gem_transactions` row.

Sources: recycling duplicates, market sales, daily missions, achievements.
Sinks: paid boosters, market purchases (a transfer between players, not a sink).

### Recycling values (proposal)

| Rarity    | Gems |
| --------- | ---- |
| Common    | 1    |
| Rare      | 2    |
| Epic      | 10   |
| Legendary | 50   |
| Mythic    | 250  |

Expected recycle value if every card were a duplicate: **≈ 10.7 gems per free booster**.

Safety check — recycling a paid booster's content must never pay back its price:

| Booster   | Recycle EV / booster | Price | Ratio |
| --------- | -------------------- | ----- | ----- |
| Epic      | 24                   | 150   | 16 %  |
| Legendary | 55                   | 500   | 11 %  |
| Mythic    | 105                  | 1 500 | 7 %   |
| Divine    | 290                  | 5 000 | 6 %   |

### Income model (used to size prices)

| Player profile                     | Free boosters/day | Gems/day (mid-game)                |
| ---------------------------------- | ----------------- | ---------------------------------- |
| Casual (3–4 visits)                | ~25               | 80 missions + ~150 recycling ≈ 230 |
| Active (cap never wasted, 15/2h30) | ~70               | 80 + ~450 ≈ 530                    |

Early game, most cards are new (few duplicates) so recycling income is lower; one-time achievements
(≈ 9 200 gems in total, most of them long-term) and the welcome mission (+30) fill the gap.
Result (spending everything on a single booster type): a casual player affords an Epic booster
about 1.5 times a day, or a Mythic booster about weekly, or a Divine booster roughly every 3 weeks;
an active player about 2.3× faster. An economy simulation
script (Phase 3) will validate this with the real catalog size.

### Simulation with the real catalog (2026-10-07)

`pnpm economy:simulate` on the top 200 import (10 088 Common, 886 Rare, 401 Epic, 54 Legendary,
0 Mythic drawable characters), 25 free boosters/day + 80 gems/day from missions, every duplicate
recycled, nothing spent:

| Day | Recycle gems that day | Total gems | Distinct owned |
| --- | --------------------- | ---------- | -------------- |
| 7   | 99                    | 780        | 787            |
| 30  | 177                   | 4 781      | 2 651          |
| 90  | 164                   | 19 243     | 5 663          |

Income after 3 months ≈ 266 gems/day: an Epic booster every 0.6 day, Legendary every 1.9 days,
Mythic every 5.6 days, Divine every 19 days, consistent with the income model above. The large
Common pool keeps duplicates (and recycling income) low for months.

### Recycling rules

- A duplicate = any copy **beyond the first** of a character. The first copy can never be recycled.
- Copies locked by a listing or a pending trade cannot be recycled:
  `recyclable = quantity − 1 − locked_quantity` (never negative).
- "Recycle all duplicates" with rarity filter → preview (count + gems) → confirmation → one
  transaction.

## 4. Market (player-to-player)

- Sell one card for gems; **no tax**: the seller receives the full price.
- Atomic purchase; seller can withdraw an unsold listing; listed copy is locked.

### Limits (proposal)

| Limit                           | Default                                                              | Protects against                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Max active listings per player  | 20                                                                   | Market flooding, hoarding the order book.                                                                                               |
| Max sales per seller per day    | 20                                                                   | Turning the market into an infinite gem faucet for one account.                                                                         |
| Max purchases per buyer per day | 20                                                                   | Gem funneling from alt accounts (each alt buys from the main).                                                                          |
| Min price per rarity            | = recycle value (1/2/10/50/250)                                      | Selling a rare card for 1 gem to a second account (card funneling); also prevents pointless dumping below the guaranteed recycle value. |
| Max price per rarity            | Common 100 · Rare 200 · Epic 1 000 · Legendary 5 000 · Mythic 20 000 | Gem funneling (alt buys a Common for 50 000), price manipulation, inflation of perceived value.                                         |
| Listing lifetime                | 7 days (then expires, card unlocked)                                 | Stale listings at outdated prices.                                                                                                      |

The game targets groups of friends: no account-age or anti-multi-account restriction (decided).
All limits above are settings and can be relaxed or disabled (0 = unlimited).

Days are counted with the same reset hour as daily missions.

## 5. Shop: tiers × pools, themed packs

The shop is a grid: **pool** (whole catalog or a themed pack) × **tier** (Free, Epic, Legendary,
Mythic, Divine).

- Free tier: the player chooses any active pool; same rates, consumes free charges.
- Paid tiers: price = tier price × (1 + pack surcharge). Default surcharge **20 %**, because
  targeting a pack makes series completion easier. Example: Shōnen Legendary = 600 gems.
- Each pack can be enabled for free and/or paid tiers independently.

### Packs (themes)

Packs are DB rows managed in the **pack editor** (admin), grouped by **category** for display:
`demographic` (Shōnen, Shōjo, Seinen, Josei), `genre` (Sports, Ecchi, …), `characters`
(Waifus, Husbandos), `media_type` (anime, movies, games…), `custom` (hand-picked series).

Rule types (combined with `all` / `any` groups):

- `tag`: AniList tag with minimum rank (e.g. `Shounen` ≥ 60). Shōnen/Shōjo/Seinen are tags (category "Demographic").
- `genre`: AniList genre (e.g. `Sports`, `Ecchi`), or genre set manually on a non-AniList series.
- `gender`: character gender class (`female` → Waifus, `male` → Husbandos).
- `series_kind`: `anime`, `game`, `other` (see §10).
- `media_format`: AniList format (`TV`, `MOVIE`, `OVA`, `ONA`, …).
- `series`: explicit list of series.

Series-level rules match if **any** media of the series matches. Membership is **materialized** in
`theme_characters` (rebuilt on pack save and after imports/catalog changes) for fast draws.

The pack editor provides: translated name/description, category, visual token, rule builder,
free/paid toggles, surcharge, active toggle, and a **live preview** (characters per rarity, sample
characters, warnings for empty rarities). Empty rarity fallback: next lower rarity, then next higher.

Gender: AniList `gender` "Female" → `female`, "Male" → `male`, anything else or empty →
`unclassified`. Unclassified characters are in neither Waifus nor Husbandos until an admin sets
`gender_override`. The admin has a filtered list "unclassified characters".

Starting packs: Shōnen, Shōjo, Seinen, Sports, Ecchi, Waifus, Husbandos.

## 6. Collection, wiki, wishlist

- Collection shows owned characters with count; filters: series, rarity, theme, owned / not owned,
  duplicates, wishlist, name search; multi-key sort (rarity, name, series, date obtained, count).
- Series progress `owned active characters / active characters`. A series is **complete** when all
  its active characters are owned (quantity ≥ 1).
- Wiki entry unlocks when the character is first obtained and **stays unlocked** even if the card is
  later traded or sold. Locked entries show a silhouette and "???". Source (AniList)
  is credited on every entry.
- Wishlist: any character (owned or not); used as a collection filter, highlighted in the market and
  in trade proposals ("in their wishlist").

## 7. Trades

- Cards-for-cards proposal (1..N cards each side), optional short message.
- Recipient can accept, decline or **counter** (creates a new offer linked to the previous one,
  which becomes `countered`; locks move to the new proposer's cards).
- Proposer's offered copies are locked while pending. Recipient's requested copies are checked at
  acceptance; if unavailable the trade fails cleanly (`failed`, nothing moves).
- Optional expiry (setting `trade_offer_ttl_days`, default 0 = never). Proposer can cancel while pending.
- Players **may** trade or sell their last copy of a character, after an explicit warning in the UI;
  the wiki entry stays unlocked. (Only recycling is forbidden on the first copy.)

## 8. Missions and achievements

### Events (emitted by services inside the transaction)

`account_created`, `booster_opened {boosterType, rateTable, quantity}`, `card_obtained {rarity, isNew}`,
`card_recycled {rarity, count}`, `wishlist_added`, `wiki_entry_viewed`, `card_listed`,
`card_sold {rarity}`, `card_bought`, `trade_completed`, `feedback_submitted`.

### Missions (daily or once)

A mission = `event_type` + optional `filter` (JSON, e.g. `{ "rateTable": "divine" }`) + `target`

- `reward_gems` + `kind` (`daily` | `once`). Progress is stored per period key: the date of the
  current period computed from the reset hour/timezone (default 00:00 Europe/Paris), or `once`.
  Rewards are claimed manually. No cron: a new day simply means a new period key.

| Key                  | EN                                | FR                            | Event             | Target | Reward |
| -------------------- | --------------------------------- | ----------------------------- | ----------------- | ------ | ------ |
| `daily_open_booster` | Open your first booster           | Ouvre ton premier booster     | booster_opened    | 1      | 20     |
| `daily_recycle`      | Recycle a duplicate               | Recycle un doublon            | card_recycled     | 1      | 20     |
| `daily_wishlist`     | Add 3 characters to your wishlist | Ajoute 3 persos à ta wishlist | wishlist_added    | 3      | 20     |
| `daily_wiki`         | Open a wiki entry                 | Ouvre une fiche du wiki       | wiki_entry_viewed | 1      | 20     |
| `welcome` (once)     | Create your account               | Crée ton compte               | account_created   | 1      | 30     |

`wiki_entry_viewed` only counts unlocked entries; `wishlist_added` counts additions (removing and
re-adding the same character on the same day counts once — dedup per character per period).

### Achievements

An achievement = `metric` (key from a registry in `packages/game`) + `params` + `target` +
`reward_gems`. Admins create achievements from existing metrics without code changes; a new metric
requires code.

Metric registry (initial):

| Metric                      | Kind    | Params                                           | Listens to                              |
| --------------------------- | ------- | ------------------------------------------------ | --------------------------------------- |
| `boosters_opened`           | counter | `rateTable?`                                     | booster_opened                          |
| `cards_obtained`            | counter | `minRarity?`                                     | card_obtained                           |
| `cards_recycled`            | counter | `minRarity?`                                     | card_recycled                           |
| `cards_sold`                | counter | —                                                | card_sold                               |
| `trades_completed`          | counter | —                                                | trade_completed                         |
| `feedback_submitted`        | counter | —                                                | feedback_submitted                      |
| `distinct_characters_owned` | state   | `rarity?`                                        | card_obtained, card ownership changes   |
| `series_completed`          | state   | —                                                | card ownership changes, catalog changes |
| `catalog_completion`        | state   | — (target = % of active characters owned, 0–100) | card ownership changes, catalog changes |

Counters are lifetime values in `user_counters` (keys like `cards_obtained:epic`), so
"first Epic or better" = sum of counters for rarities ≥ Epic.

**State metrics and catalog changes** (decision):

- `distinct_characters_owned` counts characters currently owned (quantity ≥ 1), **including** those
  of deactivated series (the player keeps them).
- `series_completed` and `catalog_completion` only consider **active** series/characters.
- Progress is recomputed on every ownership change for the acting user(s), and for all users by a
  worker job after a catalog change (series toggled, characters (de)activated, import).
- **Completion is sticky**: once `completed_at` is set, an achievement is never revoked, even if
  the player later loses cards or the catalog grows. Unclaimed completed rewards stay claimable.

| Key                  | EN                  | FR                    | Metric / params                            | Target | Reward |
| -------------------- | ------------------- | --------------------- | ------------------------------------------ | ------ | ------ |
| `open_10`            | First Steps         | Premiers pas          | boosters_opened                            | 10     | 10     |
| `open_100`           | Regular             | Habitué               | boosters_opened                            | 100    | 50     |
| `open_1000`          | Hooked              | Accro                 | boosters_opened                            | 1 000  | 300    |
| `open_10000`         | Go Touch Grass      | Va donc jouer dehors  | boosters_opened                            | 10 000 | 2 000  |
| `own_50`             | Collector           | Collectionneur        | distinct_characters_owned                  | 50     | 20     |
| `own_250`            | Archivist           | Archiviste            | distinct_characters_owned                  | 250    | 75     |
| `own_1000`           | Encyclopedist       | Encyclopédiste        | distinct_characters_owned                  | 1 000  | 300    |
| `own_2000`           | Librarian           | Bibliothécaire        | distinct_characters_owned                  | 2 000  | 800    |
| `catalog_10`         | Explorer            | Explorateur           | catalog_completion                         | 10     | 300    |
| `catalog_25`         | Globetrotter        | Grand voyageur        | catalog_completion                         | 25     | 1 000  |
| `catalog_50`         | Half the World      | La moitié du monde    | catalog_completion                         | 50     | 3 000  |
| `catalog_75`         | Almost Everything   | Presque tout          | catalog_completion                         | 75     | 6 000  |
| `first_epic`         | Epic!               | Épique !              | cards_obtained {minRarity: epic}           | 1      | 20     |
| `first_legendary`    | Legendary!          | Légendaire !          | cards_obtained {minRarity: legendary}      | 1      | 75     |
| `first_mythic`       | Mythic!             | Mythique !            | cards_obtained {minRarity: mythic}         | 1      | 200    |
| `own_10_mythics`     | Pantheon            | Panthéon              | distinct_characters_owned {rarity: mythic} | 10     | 500    |
| `open_divine`        | Touched by the Gods | Touché par les dieux  | boosters_opened {rateTable: divine}        | 1      | 500    |
| `complete_1_series`  | First Album         | Premier album         | series_completed                           | 1      | 50     |
| `complete_10_series` | Album Series        | Albums en série       | series_completed                           | 10     | 300    |
| `complete_50_series` | Curator             | Conservateur          | series_completed                           | 50     | 1 000  |
| `sell_1`             | First Sale          | Première vente        | cards_sold                                 | 1      | 30     |
| `sell_10`            | Merchant            | Marchand              | cards_sold                                 | 10     | 100    |
| `sell_100`           | Wealth Manager      | Gestion de patrimoine | cards_sold                                 | 100    | 500    |
| `trade_1`            | Handshake           | Poignée de main       | trades_completed                           | 1      | 30     |
| `trade_25`           | Negotiator          | Négociateur           | trades_completed                           | 25     | 250    |
| `feedback_1`         | Critic              | Critique              | feedback_submitted                         | 1      | 100    |

The achievements page shows a global counter (completed / active), filters All / To do / Completed,
progress bars and claim buttons.

## 9. Feedback

Rating 1–5 + optional comment (max 2 000 chars). One feedback per player, editable (only the first
submission emits `feedback_submitted`). Listed in the admin.

## 10. Catalog sources

- **AniList** (default): import the top **500** anime by popularity (`isAdult` excluded), each
  completed with its franchise (seasons, movies, OVAs, side stories linked by AniList relations),
  merged into one **series**. **All characters** of each media are imported (main, supporting,
  background), **except characters without an image** (AniList placeholder `default.jpg`), which
  are skipped (decision). They are picked up by a later re-import once AniList has an image.
- **Manual AniList additions**: admin searches AniList by name or pastes ids → same pipeline.
- **Manual series** (e.g. gacha games, which AniList does not cover): admin creates a series of kind
  `game`/`other`, then characters with name, description, image upload, gender and rarity
  (no favourites → rarity chosen by the admin, default Common). A JSON bulk import (documented
  format) allows adding a whole game roster at once.

Expected size: 500 popular entries + franchises with all roles ≈ tens of thousands of characters,
mostly Commons (background characters with few favourites). Full catalog completion is therefore
unrealistic: catalog achievements use percentage tiers (10/25/50/75 %) and per-series progress is
the main collection driver. Import duration is bounded by
AniList's rate limit (≈30 req/min currently) → a full initial import takes a few hours in the worker,
with resumable progress.
