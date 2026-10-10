import { z } from 'zod'

/**
 * Levels of a player upgrade (GAME_DESIGN §9): level n costs `levels[n-1].cost` gems and gives
 * `levels[n-1].value` (absolute, not added to the previous level). Values must increase with
 * the level; no level = the upgrade is not offered.
 */
function upgradeLevelsSchema(value: z.ZodNumber, defaults: Array<{ cost: number; value: number }>) {
  return z.object({
    levels: z
      .array(z.object({ cost: z.number().int().min(0).max(100_000_000), value }))
      .max(20)
      .refine(
        (levels) => levels.every((level, i) => i === 0 || level.value > levels[i - 1]!.value),
        { message: 'Upgrade values must increase with the level' },
      )
      .default(defaults),
  })
}

/**
 * Game settings stored in the `settings` table, one row per key. Each key has a schema with
 * defaults; the defaults are what the seed writes and what is used if a row is missing.
 */
export const settingsSchemas = {
  'boosters.free': z.object({
    intervalSeconds: z.number().int().min(10).default(600),
    maxCharges: z.number().int().min(1).max(1000).default(15),
  }),
  'missions.reset': z.object({
    hour: z.number().int().min(0).max(23).default(0),
    timeZone: z.string().min(1).default('Europe/Paris'),
  }),
  /** Market limits (GAME_DESIGN §4); 0 = unlimited. Days follow `missions.reset`. */
  'market.limits': z.object({
    maxActiveListings: z.number().int().min(0).max(10_000).default(20),
    maxSalesPerDay: z.number().int().min(0).max(10_000).default(20),
    maxPurchasesPerDay: z.number().int().min(0).max(10_000).default(20),
    listingTtlDays: z.number().int().min(0).max(365).default(7),
  }),
  /**
   * Wishlist (GAME_DESIGN §6): at most `maxItems` characters; a drawn card has `boostPercent` %
   * chance to be a wished, not owned character of its rarity when the pool has one.
   */
  wishlist: z.object({
    maxItems: z.number().int().min(1).max(200).default(20),
    boostPercent: z.number().min(0).max(100).default(5),
  }),
  /**
   * Base recycle rate: every rarity's recycle value is multiplied by `multiplier` (rounded to
   * hundredths), then by the player's recycle upgrade.
   */
  recycle: z.object({
    multiplier: z.number().min(0).max(100).default(1),
  }),
  /** Upgrade: extra free booster charges stored on top of `boosters.free.maxCharges`. */
  'upgrades.boosterStorage': upgradeLevelsSchema(z.number().int().min(1).max(1000), [
    { cost: 1_000, value: 2 },
    { cost: 2_500, value: 4 },
    { cost: 5_000, value: 6 },
    { cost: 10_000, value: 8 },
    { cost: 20_000, value: 10 },
  ]),
  /** Upgrade: the free booster interval is shortened by `value` %. */
  'upgrades.boosterSpeed': upgradeLevelsSchema(z.number().int().min(1).max(90), [
    { cost: 1_000, value: 5 },
    { cost: 2_500, value: 10 },
    { cost: 5_000, value: 15 },
    { cost: 10_000, value: 20 },
    { cost: 20_000, value: 25 },
  ]),
  /** Upgrade: recycling gives `value` × the base gems (rounded to hundredths). */
  'upgrades.recycleBonus': upgradeLevelsSchema(z.number().min(1).max(100), [
    { cost: 800, value: 1.1 },
    { cost: 2_000, value: 1.25 },
    { cost: 4_000, value: 1.5 },
    { cost: 8_000, value: 1.75 },
    { cost: 16_000, value: 2 },
  ]),
  /** Favorite characters (cosmetic, ordered by the player): at most `maxItems`. */
  favorites: z.object({
    maxItems: z.number().int().min(1).max(500).default(100),
  }),
  /** Trade offers expire after this many days; 0 = never. */
  'trades.offers': z.object({
    offerTtlDays: z.number().int().min(0).max(365).default(0),
  }),
  /**
   * Local image cache: the worker downloads remote catalog images (AniList CDN) into the uploads
   * directory so players never hit the remote host. Off by default (disk usage).
   */
  'images.cache': z.object({
    enabled: z.boolean().default(false),
  }),
  /**
   * Catalog imports skip media flagged as adult (AniList `isAdult`, IGDB "Erotic" theme) unless
   * allowed. Both flags have false positives, so an instance can turn the filter off.
   */
  'imports.adult': z.object({
    allowed: z.boolean().default(false),
  }),
} as const

export type SettingKey = keyof typeof settingsSchemas
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingsSchemas)[K]>

export function defaultSettingValue<K extends SettingKey>(key: K): SettingValue<K> {
  return settingsSchemas[key].parse({}) as SettingValue<K>
}

export function parseSettingValue<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return settingsSchemas[key].parse(value) as SettingValue<K>
}
