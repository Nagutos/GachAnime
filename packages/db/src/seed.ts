import { defaultSettingValue, settingsSchemas, type SettingKey } from '@gachanime/shared'
import type { Executor } from './client'
import { boosterTiers, rarities, settings } from './schema'

/** Default rarities (GAME_DESIGN §1). Thresholds are absolute AniList favourites (ADR-015). */
export const DEFAULT_RARITIES = [
  {
    key: 'common',
    recycleValue: 1,
    marketMinPrice: 1,
    marketMaxPrice: 100,
    sortOrder: 1,
    name: { en: 'Common', fr: 'Commune' },
    colorToken: 'common',
    favouritesThreshold: 0,
  },
  {
    key: 'rare',
    recycleValue: 2,
    marketMinPrice: 2,
    marketMaxPrice: 200,
    sortOrder: 2,
    name: { en: 'Rare', fr: 'Rare' },
    colorToken: 'rare',
    favouritesThreshold: 500,
  },
  {
    key: 'epic',
    recycleValue: 10,
    marketMinPrice: 10,
    marketMaxPrice: 1000,
    sortOrder: 3,
    name: { en: 'Epic', fr: 'Épique' },
    colorToken: 'epic',
    favouritesThreshold: 3_000,
  },
  {
    key: 'legendary',
    recycleValue: 50,
    marketMinPrice: 50,
    marketMaxPrice: 5000,
    sortOrder: 4,
    name: { en: 'Legendary', fr: 'Légendaire' },
    colorToken: 'legendary',
    favouritesThreshold: 15_000,
  },
  {
    key: 'mythic',
    recycleValue: 250,
    marketMinPrice: 250,
    marketMaxPrice: 20000,
    sortOrder: 5,
    name: { en: 'Mythic', fr: 'Mythique' },
    colorToken: 'mythic',
    favouritesThreshold: 50_000,
  },
] as const

/**
 * Default booster tiers. Free tier weights come from the "at least one per booster" targets
 * (GAME_DESIGN §2: Rare 94.1 %, Epic 17.6 %, Legendary 2 %, Mythic 0.33 %); paid tiers follow the
 * GAME_DESIGN §2 table.
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
  {
    key: 'epic',
    name: { en: 'Epic booster', fr: 'Booster épique' },
    description: {
      en: 'Many more Epic cards, and better odds for the rarest ones.',
      fr: 'Bien plus de cartes épiques, et de meilleures chances pour les plus rares.',
    },
    weights: { common: 400_000, rare: 400_000, epic: 180_000, legendary: 16_000, mythic: 4_000 },
    priceGems: 150,
    sortOrder: 1,
    artToken: 'epic',
  },
  {
    key: 'legendary',
    name: { en: 'Legendary booster', fr: 'Booster légendaire' },
    description: {
      en: 'Legendary cards become common sights.',
      fr: 'Les cartes légendaires deviennent monnaie courante.',
    },
    weights: { common: 300_000, rare: 400_000, epic: 200_000, legendary: 85_000, mythic: 15_000 },
    priceGems: 500,
    sortOrder: 2,
    artToken: 'legendary',
  },
  {
    key: 'mythic',
    name: { en: 'Mythic booster', fr: 'Booster mythique' },
    description: {
      en: 'The best odds of finding a Mythic card.',
      fr: 'Les meilleures chances de trouver une carte mythique.',
    },
    weights: { common: 200_000, rare: 400_000, epic: 250_000, legendary: 100_000, mythic: 50_000 },
    priceGems: 1_500,
    sortOrder: 3,
    artToken: 'mythic',
  },
  {
    key: 'divine',
    name: { en: 'Divine booster', fr: 'Booster divin' },
    description: {
      en: 'Only Epic cards or better.',
      fr: 'Uniquement des cartes épiques ou mieux.',
    },
    weights: { common: 0, rare: 0, epic: 550_000, legendary: 300_000, mythic: 150_000 },
    priceGems: 5_000,
    sortOrder: 4,
    artToken: 'divine',
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
