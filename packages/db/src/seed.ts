import { defaultSettingValue, settingsSchemas, type SettingKey } from '@gachanime/shared'
import type { Executor } from './client'
import { boosterTiers, rarities, settings } from './schema'

/** Default rarities (GAME_DESIGN §1). Thresholds are absolute AniList favourites (ADR-015). */
export const DEFAULT_RARITIES = [
  {
    key: 'common',
    sortOrder: 1,
    name: { en: 'Common', fr: 'Commune' },
    colorToken: 'common',
    favouritesThreshold: 0,
  },
  {
    key: 'rare',
    sortOrder: 2,
    name: { en: 'Rare', fr: 'Rare' },
    colorToken: 'rare',
    favouritesThreshold: 500,
  },
  {
    key: 'epic',
    sortOrder: 3,
    name: { en: 'Epic', fr: 'Épique' },
    colorToken: 'epic',
    favouritesThreshold: 3_000,
  },
  {
    key: 'legendary',
    sortOrder: 4,
    name: { en: 'Legendary', fr: 'Légendaire' },
    colorToken: 'legendary',
    favouritesThreshold: 15_000,
  },
  {
    key: 'mythic',
    sortOrder: 5,
    name: { en: 'Mythic', fr: 'Mythique' },
    colorToken: 'mythic',
    favouritesThreshold: 50_000,
  },
] as const

/**
 * Default booster tiers. Free tier weights come from the "at least one per booster" targets
 * (GAME_DESIGN §2: Rare 94.1 %, Epic 17.6 %, Legendary 2 %, Mythic 0.33 %); paid tiers arrive
 * with the economy (Phase 3).
 */
export const DEFAULT_BOOSTER_TIERS = [
  {
    key: 'free',
    name: { en: 'Free booster', fr: 'Booster gratuit' },
    description: {
      en: 'Five cards from the whole catalog. A new one every few minutes.',
      fr: 'Cinq cartes de tout le catalogue. Un nouveau toutes les quelques minutes.',
    },
    weights: { common: 525_097, rare: 432_233, epic: 37_977, legendary: 4_032, mythic: 661 },
    priceGems: null,
    sortOrder: 0,
    artToken: 'free',
  },
] as const

/** Idempotent seed: inserts missing default rows, never overwrites admin changes. */
export async function seed(db: Executor): Promise<void> {
  const keys = Object.keys(settingsSchemas) as SettingKey[]
  await db
    .insert(settings)
    .values(keys.map((key) => ({ key, value: defaultSettingValue(key) })))
    .onConflictDoNothing()
  await db
    .insert(rarities)
    .values(DEFAULT_RARITIES.map((rarity) => ({ ...rarity, name: { ...rarity.name } })))
    .onConflictDoNothing()
  await db
    .insert(boosterTiers)
    .values(
      DEFAULT_BOOSTER_TIERS.map((tier) => ({
        ...tier,
        name: { ...tier.name },
        description: { ...tier.description },
        weights: { ...tier.weights },
      })),
    )
    .onConflictDoNothing()
}
