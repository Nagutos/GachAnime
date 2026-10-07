import { AppError } from '@gachanime/core'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

vi.mock('./logger', () => ({ logger: { error: vi.fn() } }))
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
