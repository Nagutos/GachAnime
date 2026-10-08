import { AppError } from '@gachanime/core'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

vi.mock('./logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('./env', () => ({ getEnv: () => ({ PUBLIC_URL: 'https://game.example.com/' }) }))
const { parseJsonBody, route, toErrorResponse } = await import('./http')

describe('toErrorResponse', () => {
  it('maps business errors to their HTTP status and code', async () => {
    const response = toErrorResponse(new AppError('NOT_FOUND', 'Nope'))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Nope' } })
  })

  it('maps validation errors to VALIDATION_FAILED', async () => {
    const result = z.object({ a: z.number() }).safeParse({ a: 'x' })
    const response = toErrorResponse(result.error)
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('VALIDATION_FAILED')
  })

  it('hides unexpected errors', async () => {
    const response = toErrorResponse(new Error('db password is hunter2'))
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('hunter2')
  })
})

describe('route + parseJsonBody', () => {
  const handler = route(async (request: Request) => {
    const body = await parseJsonBody(request, z.object({ locale: z.string() }))
    return Response.json(body)
  })

  it('rejects malformed JSON', async () => {
    const response = await handler(new Request('http://x', { method: 'POST', body: '{' }), {})
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('BAD_REQUEST')
  })

  it('passes valid bodies through', async () => {
    const request = new Request('http://x', { method: 'POST', body: '{"locale":"fr"}' })
    expect(await (await handler(request, {})).json()).toEqual({ locale: 'fr' })
  })
})

describe('route origin check', () => {
  const handler = route(async () => Response.json({ ok: true }))
  const send = (method: string, origin?: string) =>
    handler(new Request('http://x', { method, headers: origin ? { origin } : {} }), {})

  it('accepts same-origin and origin-less mutations', async () => {
    expect((await send('POST', 'https://game.example.com')).status).toBe(200)
    expect((await send('DELETE')).status).toBe(200)
  })

  it('rejects cross-origin mutations', async () => {
    const response = await send('POST', 'https://evil.example')
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('FORBIDDEN')
    expect((await send('PATCH', 'null')).status).toBe(403)
  })

  it('lets cross-origin reads through (no state change)', async () => {
    expect((await send('GET', 'https://evil.example')).status).toBe(200)
  })
})
