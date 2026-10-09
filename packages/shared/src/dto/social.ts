import { z } from 'zod'
import { rarityKeySchema } from '../catalog'
import { booleanQuery, paginatedSchema, paginationQuerySchema } from './pagination'
import { characterCardSchema } from './player'
import { progressionUpdateSchema } from './progression'

const idSchema = z.number().int().positive()
export const usernameSchema = z.string().regex(/^[a-z0-9_]{3,32}$/)

// ─── Players and profiles ────────────────────────────────────────────────────

export const playerSummarySchema = z.object({
  username: usernameSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type PlayerSummary = z.infer<typeof playerSummarySchema>

export const playersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(50).optional(),
})
export const playersListSchema = paginatedSchema(
  playerSummarySchema.extend({ owned: z.number().int().nonnegative() }),
)

export const playerProfileSchema = playerSummarySchema.extend({
  memberSince: z.iso.datetime(),
  stats: z.object({
    owned: z.number().int().nonnegative(),
    cards: z.number().int().nonnegative(),
    catalog: z.number().int().nonnegative(),
    seriesCompleted: z.number().int().nonnegative(),
    achievementsCompleted: z.number().int().nonnegative(),
    achievementsTotal: z.number().int().nonnegative(),
  }),
  achievements: z.array(
    z.object({
      key: z.string(),
      name: z.record(z.string(), z.string()),
      completedAt: z.iso.datetime(),
    }),
  ),
  isMe: z.boolean(),
})
export type PlayerProfile = z.infer<typeof playerProfileSchema>

/** Cards owned by a player, as seen by another one (profile, trade composer). */
export const playerCardsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  rarity: rarityKeySchema.optional(),
  /** Only copies that can be traded or sold (not locked). */
  tradable: booleanQuery,
  /** Only cards the viewer has in their wishlist. */
  viewerWishlist: booleanQuery,
  sort: z.enum(['rarity', 'name', 'recent']).default('rarity'),
})
export type PlayerCardsQuery = z.infer<typeof playerCardsQuerySchema>
export type PlayerCardsQueryInput = z.input<typeof playerCardsQuerySchema>

export const playerCardSchema = characterCardSchema.extend({
  quantity: z.number().int().positive(),
  /** Copies not locked by a listing or a trade. */
  tradable: z.number().int().nonnegative(),
  /** In the viewer's wishlist. */
  inViewerWishlist: z.boolean(),
  /** In the owner's wishlist (e.g. they want more copies). */
  inOwnerWishlist: z.boolean(),
})
export type PlayerCard = z.infer<typeof playerCardSchema>
export const playerCardsResponseSchema = paginatedSchema(playerCardSchema)

/** A player's wishlist as seen by another one (profile): who owns each character. */
export const playerWishlistItemSchema = characterCardSchema.extend({
  /** The wishlist owner has a copy now (no boost for it). */
  ownerOwns: z.boolean(),
  /** Copies the viewer could trade now (not locked by a listing or a trade). */
  viewerTradable: z.number().int().nonnegative(),
})
export type PlayerWishlistItem = z.infer<typeof playerWishlistItemSchema>
export const playerWishlistResponseSchema = z.object({
  items: z.array(playerWishlistItemSchema),
  maxItems: z.number().int().positive(),
})
export type PlayerWishlistResponse = z.infer<typeof playerWishlistResponseSchema>

// ─── Trades ──────────────────────────────────────────────────────────────────

export const TRADE_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'countered',
  'expired',
  'failed',
] as const
export type TradeStatus = (typeof TRADE_STATUSES)[number]

export const tradeItemInputSchema = z.object({
  characterId: idSchema,
  quantity: z.number().int().min(1).max(100),
})

const tradeSide = z
  .array(tradeItemInputSchema)
  .min(1)
  .max(30)
  .refine((items) => new Set(items.map((item) => item.characterId)).size === items.length, {
    message: 'Each character appears once per side',
  })

export const proposeTradeSchema = z.object({
  recipient: usernameSchema,
  /** Cards the proposer gives. */
  offer: tradeSide,
  /** Cards the proposer asks for. */
  request: tradeSide,
  message: z.string().trim().max(300).optional(),
})
export type ProposeTradeRequest = z.infer<typeof proposeTradeSchema>

export const counterTradeSchema = proposeTradeSchema.omit({ recipient: true })
export type CounterTradeRequest = z.infer<typeof counterTradeSchema>

export const tradeItemSchema = z.object({
  quantity: z.number().int().positive(),
  character: characterCardSchema,
  /** In the wishlist of the player who receives it. */
  wishedByReceiver: z.boolean(),
})
export type TradeItem = z.infer<typeof tradeItemSchema>

export const tradeSchema = z.object({
  id: idSchema,
  status: z.enum(TRADE_STATUSES),
  /** Whether the current player proposed it. */
  outgoing: z.boolean(),
  counterpart: playerSummarySchema,
  /** Cards the current player gives / receives if accepted. */
  give: z.array(tradeItemSchema),
  receive: z.array(tradeItemSchema),
  message: z.string().nullable(),
  parentTradeId: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  respondedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
})
export type TradeDto = z.infer<typeof tradeSchema>

export const tradesQuerySchema = paginationQuerySchema.extend({
  box: z.enum(['incoming', 'outgoing', 'history']).default('incoming'),
})
export const tradesListSchema = paginatedSchema(tradeSchema).extend({
  pendingIncoming: z.number().int().nonnegative(),
})

export const tradeActionResultSchema = z.object({
  trade: tradeSchema,
  progression: progressionUpdateSchema,
})

// ─── Market ──────────────────────────────────────────────────────────────────

export const createListingSchema = z.object({
  characterId: idSchema,
  price: z.number().int().min(1).max(100_000_000),
})
export type CreateListingRequest = z.infer<typeof createListingSchema>

export const LISTING_STATUSES = ['active', 'sold', 'withdrawn', 'expired'] as const

export const listingSchema = z.object({
  id: idSchema,
  status: z.enum(LISTING_STATUSES),
  price: z.number().int().positive(),
  character: characterCardSchema,
  seller: playerSummarySchema,
  buyer: playerSummarySchema.nullable(),
  isMine: z.boolean(),
  inMyWishlist: z.boolean(),
  /** Copies of this character the viewer owns. */
  myQuantity: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
})
export type ListingDto = z.infer<typeof listingSchema>

export const marketQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  rarity: rarityKeySchema.optional(),
  wishlist: booleanQuery,
  /** Hide characters the viewer already owns. */
  missing: booleanQuery,
  sort: z.enum(['recent', 'price_asc', 'price_desc', 'rarity']).default('recent'),
})
export type MarketQuery = z.infer<typeof marketQuerySchema>
export type MarketQueryInput = z.input<typeof marketQuerySchema>
export const listingsResponseSchema = paginatedSchema(listingSchema)

export const myListingsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['active', 'closed']).default('active'),
})

/** Market rules shown when selling. */
export const marketRulesSchema = z.object({
  limits: z.object({
    maxActiveListings: z.number().int(),
    maxSalesPerDay: z.number().int(),
    maxPurchasesPerDay: z.number().int(),
    listingTtlDays: z.number().int(),
  }),
  usage: z.object({
    activeListings: z.number().int(),
    salesToday: z.number().int(),
    purchasesToday: z.number().int(),
  }),
  priceBounds: z.array(
    z.object({ rarityKey: rarityKeySchema, min: z.number().int(), max: z.number().int() }),
  ),
})
export type MarketRules = z.infer<typeof marketRulesSchema>

export const listingActionResultSchema = z.object({
  listing: listingSchema,
  gemBalance: z.number().int().nonnegative(),
  progression: progressionUpdateSchema,
})

// ─── Admin: users ────────────────────────────────────────────────────────────

export const adminUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  banned: booleanQuery,
})
export const adminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['user', 'admin']),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  gemBalance: z.number().int(),
  owned: z.number().int(),
  createdAt: z.iso.datetime(),
})
export type AdminUser = z.infer<typeof adminUserSchema>
export const adminUsersListSchema = paginatedSchema(adminUserSchema)
export const updateAdminUserSchema = z
  .object({
    role: z.enum(['user', 'admin']),
    banned: z.boolean(),
    banReason: z.string().trim().max(300).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
export type UpdateAdminUserRequest = z.infer<typeof updateAdminUserSchema>
