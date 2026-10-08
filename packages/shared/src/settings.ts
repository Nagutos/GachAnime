import { z } from 'zod'

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
