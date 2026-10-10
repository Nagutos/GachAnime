import { z } from 'zod'
import { rarityKeySchema } from '../catalog'
import { localizedTextSchema } from '../localized-text'
import { rateWeightsSchema } from '../rates'
import { settingsSchemas } from '../settings'

// ─── Settings ────────────────────────────────────────────────────────────────

export const adminSettingsSchema = z.object({
  'boosters.free': settingsSchemas['boosters.free'],
  'missions.reset': settingsSchemas['missions.reset'],
  'market.limits': settingsSchemas['market.limits'],
  wishlist: settingsSchemas.wishlist,
  favorites: settingsSchemas.favorites,
  recycle: settingsSchemas.recycle,
  'upgrades.boosterStorage': settingsSchemas['upgrades.boosterStorage'],
  'upgrades.boosterSpeed': settingsSchemas['upgrades.boosterSpeed'],
  'upgrades.recycleBonus': settingsSchemas['upgrades.recycleBonus'],
  'trades.offers': settingsSchemas['trades.offers'],
  'images.cache': settingsSchemas['images.cache'],
  'imports.adult': settingsSchemas['imports.adult'],
})
export type AdminSettings = z.infer<typeof adminSettingsSchema>

// ─── Rarities ────────────────────────────────────────────────────────────────

export const adminRaritySchema = z.object({
  key: rarityKeySchema,
  sortOrder: z.number().int(),
  name: localizedTextSchema,
  colorToken: z.string(),
  favouritesThreshold: z.number().int().nonnegative(),
  gamePopularityThreshold: z.number().int().nonnegative(),
  recycleValue: z.number().int().nonnegative(),
  marketMinPrice: z.number().int().nonnegative(),
  marketMaxPrice: z.number().int().nonnegative(),
})
export type AdminRarity = z.infer<typeof adminRaritySchema>

export const adminRaritiesResponseSchema = z.object({ rarities: z.array(adminRaritySchema) })

export const updateRaritySchema = z
  .object({
    name: localizedTextSchema,
    colorToken: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    favouritesThreshold: z.number().int().min(0).max(10_000_000),
    gamePopularityThreshold: z.number().int().min(0).max(10_000_000),
    recycleValue: z.number().int().min(0).max(1_000_000),
    marketMinPrice: z.number().int().min(0).max(100_000_000),
    marketMaxPrice: z.number().int().min(0).max(100_000_000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
export type UpdateRarityRequest = z.infer<typeof updateRaritySchema>

export const updateRarityResultSchema = z.object({
  /** AniList characters whose default rarity changed with the new thresholds. */
  recomputedCharacters: z.number().int().nonnegative(),
})

// ─── Booster tiers ───────────────────────────────────────────────────────────

export const adminBoosterTierSchema = z.object({
  key: z.string(),
  name: localizedTextSchema,
  description: localizedTextSchema.nullable(),
  weights: z.record(z.string(), z.number().int().nonnegative()),
  priceGems: z.number().int().nonnegative().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  artToken: z.string(),
  /** Openings ever made with this tier. */
  openings: z.number().int().nonnegative(),
})
export type AdminBoosterTier = z.infer<typeof adminBoosterTierSchema>

export const adminBoosterTiersResponseSchema = z.object({
  tiers: z.array(adminBoosterTierSchema),
})

/** The free tier keeps `priceGems: null`; a paid tier needs a price. */
export const updateBoosterTierSchema = z
  .object({
    name: localizedTextSchema,
    description: localizedTextSchema.nullable(),
    weights: rateWeightsSchema,
    priceGems: z.number().int().min(1).max(100_000_000),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
export type UpdateBoosterTierRequest = z.infer<typeof updateBoosterTierSchema>
