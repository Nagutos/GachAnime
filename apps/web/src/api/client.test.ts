import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ApiError, apiFetch } from './client'

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('apiFetch', () => {
  it('parses successful responses with the schema', async () => {
    mockFetch(200, { value: 1 })
    await expect(apiFetch('/x', { schema: z.object({ value: z.number() }) })).resolves.toEqual({
      value: 1,
    })
  })

  it('turns API errors into ApiError with their code', async () => {
    mockFetch(429, { error: { code: 'RATE_LIMITED', message: 'Too many requests' } })
    const error = await apiFetch('/x', { schema: z.unknown() }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 })
  })

  it('reports network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    )
    await expect(apiFetch('/x', { schema: z.unknown() })).rejects.toMatchObject({ code: 'NETWORK' })
  })
})
