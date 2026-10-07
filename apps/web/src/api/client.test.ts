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

describe('apiFetch bodies', () => {
  it('sends FormData as multipart without forcing a JSON content type', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('{"ok":true}'),
    )
    vi.stubGlobal('fetch', fetchMock)
    const form = new FormData()
    form.set('file', new Blob(['x']), 'x.png')
    await apiFetch('/upload', { method: 'POST', body: form, schema: z.object({ ok: z.boolean() }) })
    const init = fetchMock.mock.calls[0]![1]
    expect(init.body).toBe(form)
    expect((init.headers as Record<string, string>)['content-type']).toBeUndefined()
  })

  it('accepts empty 204 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )
    await expect(apiFetch('/x', { method: 'DELETE', schema: z.null() })).resolves.toBeNull()
  })
})
