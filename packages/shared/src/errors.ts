import { z } from 'zod'

/**
 * Stable error codes returned by the API. The web app translates them with the
 * `errors.<CODE>` i18n keys and never displays the English `message` directly.
 */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'IDEMPOTENCY_IN_PROGRESS',
  'IMPORT_IN_PROGRESS',
  'ANILIST_UNAVAILABLE',
  'IGDB_UNAVAILABLE',
  'IGDB_NOT_CONFIGURED',
  'INVALID_IMAGE',
  'NOT_MANUAL_ENTRY',
  'BOOSTER_UNAVAILABLE',
  'NOT_ENOUGH_CHARGES',
  'EMPTY_POOL',
  'NOT_ENOUGH_GEMS',
  'NOTHING_TO_RECYCLE',
  'PREVIEW_OUTDATED',
  'NOT_CLAIMABLE',
  'THEME_UNAVAILABLE',
  'CARD_UNAVAILABLE',
  'LISTING_UNAVAILABLE',
  'MARKET_LIMIT_REACHED',
  'PRICE_OUT_OF_RANGE',
  'WISHLIST_FULL',
  'FAVORITES_FULL',
  'UPGRADE_UNAVAILABLE',
  'UPGRADE_LEVEL_CHANGED',
  'NOT_OBTAINED',
  'TRADE_NOT_PENDING',
  'INVALID_TRADE',
  'PLAYER_BANNED',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorBody = z.infer<typeof apiErrorSchema>
