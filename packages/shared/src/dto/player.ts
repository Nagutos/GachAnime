import { z } from 'zod'
import { rarityKeySchema, seriesKindSchema, slugSchema } from '../catalog'
import { localizedTextSchema } from '../localized-text'
import { booleanQuery, paginatedSchema, paginationQuerySchema } from './pagination'

const idSchema = z.number().int().positive()

// ─── Rarities and cards ──────────────────────────────────────────────────────

export const publicRaritySchema = z.object({
  key: rarityKeySchema,
  sortOrder: z.number().int(),
  name: localizedTextSchema,
  colorToken: z.string(),
})
export type PublicRarity = z.infer<typeof publicRaritySchema>

export const raritiesResponseSchema = z.object({ rarities: z.array(publicRaritySchema) })

export const seriesRefSchema = z.object({ id: idSchema, title: z.string() })
export type SeriesRef = z.infer<typeof seriesRefSchema>

/** A revealed character card (owned, or just drawn). */
export const characterCardSchema = z.object({
  id: idSchema,
  name: z.string(),
  nameNative: z.string().nullable(),
  imageUrl: z.string().nullable(),
  rarityKey: rarityKeySchema,
  /** Most popular active series of the character. */
  series: seriesRefSchema.nullable(),
})
export type CharacterCard = z.infer<typeof characterCardSchema>

// ─── Boosters ────────────────────────────────────────────────────────────────

export const BOOSTER_QUANTITIES = [1, 5, 10] as const
export type BoosterQuantity = (typeof BOOSTER_QUANTITIES)[number]

export const freeBoosterStatusSchema = z.object({
  available: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  intervalSeconds: z.number().int().positive(),
  /** Null when the cap is reached. */
  nextChargeAt: z.iso.datetime().nullable(),
  fullAt: z.iso.datetime().nullable(),
  /** Lets the client correct its clock for the countdown. */
  serverTime: z.iso.datetime(),
})
export type FreeBoosterStatus = z.infer<typeof freeBoosterStatusSchema>

export const boosterTierDtoSchema = z.object({
  key: z.string(),
  name: localizedTextSchema,
  description: localizedTextSchema.nullable(),
  /** Null = free tier (uses free charges). */
  priceGems: z.number().int().nonnegative().nullable(),
  artToken: z.string(),
  /** Per-card rates in parts per million, by rarity key (shown to players). */
  weights: z.record(z.string(), z.number().int().nonnegative()),
})
export type BoosterTierDto = z.infer<typeof boosterTierDtoSchema>

export const boostersResponseSchema = z.object({
  tiers: z.array(boosterTierDtoSchema),
  free: freeBoosterStatusSchema,
  cardsPerBooster: z.number().int().positive(),
})
export type BoostersResponse = z.infer<typeof boostersResponseSchema>

export const openBoostersRequestSchema = z.object({
  tier: z.string().min(1).max(64),
  quantity: z.union(BOOSTER_QUANTITIES.map((value) => z.literal(value))),
})
export type OpenBoostersRequest = z.infer<typeof openBoostersRequestSchema>

export const openedCardSchema = z.object({
  /** 0-based across the request: booster index = floor(position / cardsPerBooster). */
  position: z.number().int().nonnegative(),
  /** First copy ever obtained: the wiki entry was just unlocked. */
  isNew: z.boolean(),
  character: characterCardSchema,
})
export type OpenedCard = z.infer<typeof openedCardSchema>

export const openBoostersResponseSchema = z.object({
  openingId: idSchema,
  tier: z.string(),
  quantity: z.number().int().positive(),
  cardsPerBooster: z.number().int().positive(),
  cards: z.array(openedCardSchema),
  free: freeBoosterStatusSchema,
})
export type OpenBoostersResponse = z.infer<typeof openBoostersResponseSchema>

// ─── Collection ──────────────────────────────────────────────────────────────

export const COLLECTION_SORTS = ['recent', 'rarity', 'name', 'count'] as const

export const collectionQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  rarity: rarityKeySchema.optional(),
  seriesId: z.coerce.number().int().positive().optional(),
  /** Only characters owned more than once. */
  duplicates: booleanQuery,
  sort: z.enum(COLLECTION_SORTS).default('recent'),
})
export type CollectionQuery = z.infer<typeof collectionQuerySchema>

export const collectionItemSchema = characterCardSchema.extend({
  quantity: z.number().int().positive(),
  firstObtainedAt: z.iso.datetime(),
  lastObtainedAt: z.iso.datetime(),
})
export type CollectionItem = z.infer<typeof collectionItemSchema>

export const collectionResponseSchema = paginatedSchema(collectionItemSchema).extend({
  summary: z.object({
    /** Distinct characters currently owned. */
    owned: z.number().int().nonnegative(),
    /** Cards currently owned, duplicates included. */
    cards: z.number().int().nonnegative(),
    /** Drawable characters in the catalog. */
    catalog: z.number().int().nonnegative(),
  }),
})
export type CollectionResponse = z.infer<typeof collectionResponseSchema>

// ─── Wiki ────────────────────────────────────────────────────────────────────

export const wikiSeriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['popularity', 'title', 'progress']).default('popularity'),
})
export type WikiSeriesQuery = z.infer<typeof wikiSeriesQuerySchema>

export const wikiSeriesItemSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  kind: seriesKindSchema,
  title: z.string(),
  titleEnglish: z.string().nullable(),
  coverUrl: z.string().nullable(),
  /** Active characters of the series. */
  characterCount: z.number().int().nonnegative(),
  /** Wiki entries unlocked by the player. */
  unlockedCount: z.number().int().nonnegative(),
  /** Characters currently owned (series progress). */
  ownedCount: z.number().int().nonnegative(),
})
export type WikiSeriesItem = z.infer<typeof wikiSeriesItemSchema>

export const wikiSeriesListSchema = paginatedSchema(wikiSeriesItemSchema)

export const wikiSeriesDetailSchema = wikiSeriesItemSchema.extend({
  description: z.string().nullable(),
  genres: z.array(z.string()),
  source: z.enum(['anilist', 'manual']),
  /** AniList page of the main media, for the credit link. */
  siteUrl: z.string().nullable(),
})
export type WikiSeriesDetail = z.infer<typeof wikiSeriesDetailSchema>

export const wikiCharactersQuerySchema = paginationQuerySchema.extend({
  /** `unlocked` / `locked` filter; none = all. */
  unlocked: booleanQuery,
})
export type WikiCharactersQuery = z.infer<typeof wikiCharactersQuerySchema>

/** Locked entries reveal nothing but their rarity: no name, no picture (silhouette + "???"). */
export const wikiEntrySummarySchema = z.discriminatedUnion('locked', [
  z.object({ locked: z.literal(true), id: idSchema, rarityKey: rarityKeySchema }),
  z.object({
    locked: z.literal(false),
    id: idSchema,
    rarityKey: rarityKeySchema,
    name: z.string(),
    imageUrl: z.string().nullable(),
    /** Copies currently owned (0 after a trade or sale: the entry stays unlocked). */
    quantity: z.number().int().nonnegative(),
  }),
])
export type WikiEntrySummary = z.infer<typeof wikiEntrySummarySchema>

export const wikiCharacterListSchema = paginatedSchema(wikiEntrySummarySchema)

export const wikiAppearanceSchema = z.object({
  title: z.string(),
  format: z.string().nullable(),
  seasonYear: z.number().int().nullable(),
  role: z.enum(['MAIN', 'SUPPORTING', 'BACKGROUND']),
})

export const wikiCharacterSchema = z.discriminatedUnion('locked', [
  z.object({
    locked: z.literal(true),
    id: idSchema,
    rarityKey: rarityKeySchema,
    series: z.array(seriesRefSchema),
  }),
  z.object({
    locked: z.literal(false),
    id: idSchema,
    rarityKey: rarityKeySchema,
    series: z.array(seriesRefSchema),
    name: z.string(),
    nameNative: z.string().nullable(),
    nameAlternatives: z.array(z.string()),
    /** AniList markdown (spoilers as `~!…!~`); the client renders it as plain text. */
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    source: z.enum(['anilist', 'manual']),
    /** AniList character page (credit link); null for manual characters. */
    anilistUrl: z.string().nullable(),
    appearances: z.array(wikiAppearanceSchema),
    quantity: z.number().int().nonnegative(),
    firstObtainedAt: z.iso.datetime(),
  }),
])
export type WikiCharacter = z.infer<typeof wikiCharacterSchema>
