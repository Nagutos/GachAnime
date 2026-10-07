import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AniListClient, AniListError } from './client'

/** Fake clock: `sleep` advances time instantly. */
function fakeClock() {
  let now = 0
  return { now: () => now, sleep: async (ms: number) => void (now += ms) }
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })

const schema = z.object({ ok: z.boolean() })

describe('AniListClient', () => {
  it('spaces requests according to the rate limit announced by AniList', async () => {
    const clock = fakeClock()
    const sentAt: number[] = []
    const client = new AniListClient({
      ...clock,
      requestsPerMinute: 30,
      fetch: async () => {
        sentAt.push(clock.now())
        return json({ data: { ok: true } }, { headers: { 'x-ratelimit-limit': '60' } })
      },
    })
    await Promise.all([1, 2, 3].map(() => client.query('q', {}, schema)))
    // First request at 0, then the server limit (60/min) gives 1 s + margin between requests.
    expect(sentAt[0]).toBe(0)
    expect(sentAt[1]! - sentAt[0]!).toBeGreaterThanOrEqual(2000)
    expect(sentAt[2]! - sentAt[1]!).toBeGreaterThanOrEqual(1000)
    expect(sentAt[2]! - sentAt[1]!).toBeLessThan(2000)
    expect(client.requestCount).toBe(3)
  })

  it('waits for Retry-After on 429 then succeeds', async () => {
    const clock = fakeClock()
    const responses = [
      json(
        { errors: [{ message: 'Too Many Requests.' }] },
        { status: 429, headers: { 'retry-after': '30' } },
      ),
      json({ data: { ok: true } }),
    ]
    const client = new AniListClient({ ...clock, fetch: async () => responses.shift()! })
    await expect(client.query('q', {}, schema)).resolves.toEqual({ ok: true })
    expect(clock.now()).toBeGreaterThanOrEqual(31_000)
  })

  it('retries server and network errors, then gives up', async () => {
    const clock = fakeClock()
    let calls = 0
    const client = new AniListClient({
      ...clock,
      maxRetries: 2,
      fetch: async () => {
        calls += 1
        if (calls === 1) throw new TypeError('fetch failed')
        return json({}, { status: 502 })
      },
    })
    await expect(client.query('q', {}, schema)).rejects.toBeInstanceOf(AniListError)
    expect(calls).toBe(3)
  })

  it('does not retry GraphQL errors and keeps serving later queries', async () => {
    const clock = fakeClock()
    const responses = [
      json({ data: null, errors: [{ message: 'Not Found.', status: 404 }] }, { status: 404 }),
      json({ data: { ok: true } }),
    ]
    const client = new AniListClient({ ...clock, fetch: async () => responses.shift()! })
    await expect(client.query('q', {}, schema)).rejects.toThrow('Not Found.')
    await expect(client.query('q', {}, schema)).resolves.toEqual({ ok: true })
  })
})
