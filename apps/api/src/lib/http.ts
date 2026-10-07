import { AppError } from '@gachanime/core'
import type { ApiErrorBody, ErrorCode } from '@gachanime/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
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
  INVALID_IMAGE: 400,
  ANILIST_UNAVAILABLE: 502,
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

/** Wraps a route handler so every thrown error becomes a typed JSON error response. */
export function route<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    try {
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
