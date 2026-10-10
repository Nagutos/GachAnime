import { z } from 'zod'
import {
  catalogSourceSchema,
  genderClassSchema,
  rarityKeySchema,
  seriesKindSchema,
  slugSchema,
} from '../catalog'
import { localizedTextSchema } from '../localized-text'
import { booleanQuery, paginatedSchema, paginationQuerySchema } from './pagination'
import { themeDtoSchema, themeKeySchema } from '../themes'
import { progressionUpdateSchema } from './progression'

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

/** Series of a booster pool (preview before opening): the whole catalog, or one pack. */
export const poolSeriesQuerySchema = z.object({ theme: themeKeySchema.optional() })

export const poolSeriesSchema = z.object({
  id: idSchema,
  title: z.string(),
  coverUrl: z.string().nullable(),
  /** Drawable characters of this series in the pool. */
  characters: z.number().int().positive(),
  /** Of those, the ones the player owns. */
  owned: z.number().int().nonnegative(),
})
export type PoolSeries = z.infer<typeof poolSeriesSchema>

export const poolSeriesResponseSchema = z.object({
  /** Most popular first. */
  series: z.array(poolSeriesSchema),
})
export type PoolSeriesResponse = z.infer<typeof poolSeriesResponseSchema>

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
  gemBalance: z.number().int().nonnegative(),
  /** Active packs with at least one drawable character. */
  themes: z.array(themeDtoSchema),
})
export type BoostersResponse = z.infer<typeof boostersResponseSchema>

export const openBoostersRequestSchema = z.object({
  tier: z.string().min(1).max(64),
  /** A pack (theme) key; none = the whole catalog. */
  theme: themeKeySchema.optional(),
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
  theme: z.string().nullable(),
  quantity: z.number().int().positive(),
  cardsPerBooster: z.number().int().positive(),
  cards: z.array(openedCardSchema),
  free: freeBoosterStatusSchema,
  gemsSpent: z.number().int().nonnegative(),
  gemBalance: z.number().int().nonnegative(),
  progression: progressionUpdateSchema,
})
export type OpenBoostersResponse = z.infer<typeof openBoostersResponseSchema>

// ─── Collection ──────────────────────────────────────────────────────────────

/** `favorite`: the player's favorites order (ascending), other cards after them. */
export const COLLECTION_SORT_KEYS = [
  'recent',
  'rarity',
  'name',
  'count',
  'series',
  'favorite',
] as const
export type CollectionSortKey = (typeof COLLECTION_SORT_KEYS)[number]
export const COLLECTION_OWNERSHIP = ['owned', 'missing', 'all'] as const

export const collectionSortSchema = z.object({
  key: z.enum(COLLECTION_SORT_KEYS),
  direction: z.enum(['asc', 'desc']),
})
export type CollectionSort = z.infer<typeof collectionSortSchema>

/** Multi-key sort in the query string: `rarity:desc,name:asc` (max 3 keys, no repeat). */
export const collectionSortQuerySchema = z
  .string()
  .max(100)
  .transform((value, context) => {
    const sorts: CollectionSort[] = []
    for (const part of value.split(',').filter(Boolean)) {
      const [key, direction = 'asc'] = part.split(':')
      const parsed = collectionSortSchema.safeParse({ key, direction })
      if (!parsed.success || sorts.some((sort) => sort.key === parsed.data.key)) {
        context.addIssue({ code: 'custom', message: `Invalid sort "${part}"` })
        return z.NEVER
      }
      sorts.push(parsed.data)
    }
    return sorts.slice(0, 3)
  })

export function formatCollectionSort(sorts: CollectionSort[]): string {
  return sorts.map((sort) => `${sort.key}:${sort.direction}`).join(',')
}

export const collectionQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  rarity: rarityKeySchema.optional(),
  seriesId: z.coerce.number().int().positive().optional(),
  /** Pack (theme) key. */
  theme: themeKeySchema.optional(),
  /** Effective gender (admin override, else the imported class). */
  gender: genderClassSchema.optional(),
  /** Owned now (default), missing (never obtained or no copy left), or the whole catalog. */
  ownership: z.enum(COLLECTION_OWNERSHIP).default('owned'),
  /** Only characters owned more than once. */
  duplicates: booleanQuery,
  wishlist: booleanQuery,
  favorites: booleanQuery,
  sort: collectionSortQuerySchema.default([{ key: 'recent', direction: 'desc' }]),
})
export type CollectionQuery = z.infer<typeof collectionQuerySchema>
export type CollectionQueryInput = z.input<typeof collectionQuerySchema>

/** Never-obtained characters are shown (name, picture, series) greyed, like locked wiki entries. */
export const collectionItemSchema = z.discriminatedUnion('locked', [
  characterCardSchema.extend({
    locked: z.literal(true),
    wishlisted: z.boolean(),
  }),
  characterCardSchema.extend({
    locked: z.literal(false),
    /** Copies owned now (0 when the entry is unlocked but every copy is gone). */
    quantity: z.number().int().nonnegative(),
    lockedQuantity: z.number().int().nonnegative(),
    /** Duplicates that can be recycled now. */
    recyclable: z.number().int().nonnegative(),
    wishlisted: z.boolean(),
    /** Only obtained characters can be favorites. */
    favorite: z.boolean(),
    firstObtainedAt: z.iso.datetime(),
    lastObtainedAt: z.iso.datetime(),
  }),
])
export type CollectionItem = z.infer<typeof collectionItemSchema>
export type ObtainedCollectionItem = Extract<CollectionItem, { locked: false }>

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

// ─── Wishlist ────────────────────────────────────────────────────────────────

export const wishlistResponseSchema = z.object({
  wishlisted: z.boolean(),
  progression: progressionUpdateSchema,
})

/** The player's wishlist, newest first, with its limit and the booster boost it gives. */
export const wishlistListResponseSchema = z.object({
  items: z.array(collectionItemSchema),
  maxItems: z.number().int().positive(),
  boostPercent: z.number().min(0).max(100),
})
export type WishlistListResponse = z.infer<typeof wishlistListResponseSchema>

// ─── Favorites ───────────────────────────────────────────────────────────────

export const favoriteResponseSchema = z.object({ favorite: z.boolean() })

/** The player's favorites in their own order. */
export const favoritesListResponseSchema = z.object({
  items: z.array(collectionItemSchema.options[1]),
  maxItems: z.number().int().positive(),
})
export type FavoritesListResponse = z.infer<typeof favoritesListResponseSchema>

/** New order of the favorites: every favorite exactly once. */
export const reorderFavoritesSchema = z.object({
  ids: z.array(idSchema).max(500),
})
export type ReorderFavoritesRequest = z.infer<typeof reorderFavoritesSchema>

// ─── Gems and recycling ──────────────────────────────────────────────────────

export const GEM_TRANSACTION_REASONS = [
  'booster_purchase',
  'recycle',
  'market_sale',
  'market_purchase',
  'mission_reward',
  'achievement_reward',
  'admin_adjustment',
  'upgrade_purchase',
] as const
export type GemTransactionReason = (typeof GEM_TRANSACTION_REASONS)[number]

export const gemTransactionSchema = z.object({
  id: idSchema,
  amount: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
  reason: z.enum(GEM_TRANSACTION_REASONS),
  createdAt: z.iso.datetime(),
})
export type GemTransaction = z.infer<typeof gemTransactionSchema>

export const gemHistoryResponseSchema = paginatedSchema(gemTransactionSchema).extend({
  gemBalance: z.number().int().nonnegative(),
})
export type GemHistoryResponse = z.infer<typeof gemHistoryResponseSchema>

export const RECYCLE_MAX_COUNT = 10_000

export const recycleCardsRequestSchema = z.object({
  characterId: idSchema,
  count: z.number().int().min(1).max(RECYCLE_MAX_COUNT),
})
export type RecycleCardsRequest = z.infer<typeof recycleCardsRequestSchema>

/**
 * Rarities whose duplicates are recycled (none = every rarity). Duplicates of favorites are kept
 * unless `includeFavorites`.
 */
export const recycleFilterSchema = z.object({
  rarities: z.array(rarityKeySchema).max(20).optional(),
  includeFavorites: z.boolean().optional(),
})
export type RecycleFilter = z.infer<typeof recycleFilterSchema>

export const recyclePreviewSchema = z.object({
  cards: z.number().int().nonnegative(),
  characters: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  byRarity: z.array(
    z.object({
      rarityKey: rarityKeySchema,
      cards: z.number().int().nonnegative(),
      gems: z.number().int().nonnegative(),
    }),
  ),
})
export type RecyclePreview = z.infer<typeof recyclePreviewSchema>

/** `expected` is the preview the player confirmed: the recycle fails if it changed since. */
export const recycleDuplicatesRequestSchema = recycleFilterSchema.extend({
  expected: z.object({
    cards: z.number().int().nonnegative(),
    gems: z.number().int().nonnegative(),
  }),
})
export type RecycleDuplicatesRequest = z.infer<typeof recycleDuplicatesRequestSchema>

export const recycleResultSchema = z.object({
  cards: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  gemBalance: z.number().int().nonnegative(),
  progression: progressionUpdateSchema,
})
export type RecycleResult = z.infer<typeof recycleResultSchema>

// ─── Wiki ────────────────────────────────────────────────────────────────────

export const wikiSeriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['popularity', 'title', 'progress']).default('popularity'),
  /** Series progress filter: none = all series. */
  status: z.enum(['complete', 'incomplete', 'started']).optional(),
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
  source: catalogSourceSchema,
  /** AniList page of the main media, for the credit link. */
  siteUrl: z.string().nullable(),
})
export type WikiSeriesDetail = z.infer<typeof wikiSeriesDetailSchema>

export const wikiCharactersQuerySchema = paginationQuerySchema.extend({
  /** `unlocked` / `locked` filter; none = all. */
  unlocked: booleanQuery,
})
export type WikiCharactersQuery = z.infer<typeof wikiCharactersQuerySchema>

/** Locked entries show the character (name, picture) greyed; the rest of the entry stays locked. */
export const wikiEntrySummarySchema = z.discriminatedUnion('locked', [
  z.object({
    locked: z.literal(true),
    id: idSchema,
    rarityKey: rarityKeySchema,
    name: z.string(),
    imageUrl: z.string().nullable(),
    wishlisted: z.boolean(),
  }),
  z.object({
    locked: z.literal(false),
    id: idSchema,
    rarityKey: rarityKeySchema,
    name: z.string(),
    imageUrl: z.string().nullable(),
    /** Copies currently owned (0 after a trade or sale: the entry stays unlocked). */
    quantity: z.number().int().nonnegative(),
    wishlisted: z.boolean(),
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
  /** Only the character and its series: description, appearances… unlock with the card. */
  z.object({
    locked: z.literal(true),
    id: idSchema,
    rarityKey: rarityKeySchema,
    series: z.array(seriesRefSchema),
    name: z.string(),
    imageUrl: z.string().nullable(),
    wishlisted: z.boolean(),
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
    source: catalogSourceSchema,
    /** AniList character page (credit link); null for manual characters. */
    /** Page of the character at its source (AniList, IGDB); null for manual characters. */
    sourceUrl: z.string().nullable(),
    appearances: z.array(wikiAppearanceSchema),
    quantity: z.number().int().nonnegative(),
    lockedQuantity: z.number().int().nonnegative(),
    recyclable: z.number().int().nonnegative(),
    /** Gems earned per recycled copy of this rarity. */
    recycleValue: z.number().int().nonnegative(),
    wishlisted: z.boolean(),
    favorite: z.boolean(),
    firstObtainedAt: z.iso.datetime(),
  }),
])
export type WikiCharacter = z.infer<typeof wikiCharacterSchema>
