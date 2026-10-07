import { apiErrorSchema, type ErrorCode } from '@gachanime/shared'
import type { z } from 'zod'

/** Error thrown by `apiFetch`; `code` maps to the `errors.<code>` translation key. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK',
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ApiFetchOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  schema: z.ZodType<T>
  idempotencyKey?: string
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions<T>): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError('NETWORK', 0, 'Network error')
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload)
    if (parsed.success) {
      const { code, message, details } = parsed.data.error
      throw new ApiError(code, response.status, message, details)
    }
    throw new ApiError('INTERNAL_ERROR', response.status, `HTTP ${response.status}`)
  }
  return options.schema.parse(payload)
}
