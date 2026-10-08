import { AppError } from '@gachanime/core'
import type { ApiErrorBody, ErrorCode } from '@gachanime/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getEnv } from './env'
import { logger } from './logger'

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  IMPORT_IN_PROGRESS: 409,
  NOT_MANUAL_ENTRY: 409,
  BOOSTER_UNAVAILABLE: 409,
  NOT_ENOUGH_CHARGES: 409,
  EMPTY_POOL: 409,
  NOT_ENOUGH_GEMS: 409,
  NOTHING_TO_RECYCLE: 409,
  PREVIEW_OUTDATED: 409,
  NOT_CLAIMABLE: 409,
  THEME_UNAVAILABLE: 409,
  CARD_UNAVAILABLE: 409,
  LISTING_UNAVAILABLE: 409,
  MARKET_LIMIT_REACHED: 409,
  PRICE_OUT_OF_RANGE: 400,
  TRADE_NOT_PENDING: 409,
  INVALID_TRADE: 400,
  PLAYER_BANNED: 403,
  INVALID_IMAGE: 400,
  ANILIST_UNAVAILABLE: 502,
  IGDB_UNAVAILABLE: 502,
  IGDB_NOT_CONFIGURED: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}

export function errorResponse(code: ErrorCode, message: string, details?: unknown): NextResponse {
  const body: ApiErrorBody = {
    error: { code, message, ...(details === undefined ? {} : { details }) },
  }
  return NextResponse.json(body, { status: STATUS_BY_CODE[code] })
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) return errorResponse(error.code, error.message, error.details)
  if (error instanceof z.ZodError) {
    return errorResponse('VALIDATION_FAILED', 'Invalid request', z.flattenError(error))
  }
  logger.error({ err: error }, 'unhandled API error')
  return errorResponse('INTERNAL_ERROR', 'Internal server error')
}

type RouteHandler<C> = (request: Request, context: C) => Promise<Response>

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defense in depth (session cookies are already SameSite=Lax): a state-changing request
 * sent by a browser carries an `Origin` header, which must be the instance's own origin.
 * Requests without one (CLI tools, server-to-server) are not browser-forged and pass.
 */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return
  const origin = request.headers.get('origin')
  if (origin === null) return
  if (origin !== new URL(getEnv().PUBLIC_URL).origin) {
    throw new AppError('FORBIDDEN', 'Cross-origin request rejected')
  }
}

/**
 * Wraps a route handler: rejects cross-origin mutations and turns every thrown error into a
 * typed JSON error response.
 */
export function route<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    try {
      assertSameOrigin(request)
      return await handler(request, context)
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new AppError('BAD_REQUEST', 'Request body must be valid JSON')
  }
  return schema.parse(body)
}

const idParamSchema = z.coerce.number().int().positive()

/** Parses a numeric route parameter (`/series/[id]`). */
export function parseId(value: string | undefined): number {
  const result = idParamSchema.safeParse(value)
  if (!result.success) throw new AppError('NOT_FOUND', 'Not found')
  return result.data
}

/** Parses the query string with a Zod schema. */
export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T {
  return schema.parse(Object.fromEntries(new URL(request.url).searchParams))
}
