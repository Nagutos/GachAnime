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
  const isForm = options.body instanceof FormData
  if (options.body !== undefined && !isForm) headers['content-type'] = 'application/json'
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body:
        options.body === undefined
          ? undefined
          : isForm
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError('NETWORK', 0, 'Network error')
  }

  // 204 No Content (and other empty bodies) parse as null.
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

/** `{ a: 1, b: undefined }` → `?a=1` */
export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
