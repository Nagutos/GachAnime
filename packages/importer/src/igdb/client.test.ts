import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { FakeIgdb, fakeGame } from '../test/fake-igdb'
import { IgdbClient, IgdbError } from './client'

const idSchema = z.object({ id: z.number() })

describe('IgdbClient', () => {
  it('gets a Twitch token once and reuses it', async () => {
    const fake = new FakeIgdb([fakeGame(1), fakeGame(2)], [])
    const client = fake.client()
    await client.query('games', 'fields id; where id = (1);', idSchema)
    await client.query('games', 'fields id; where id = (2);', idSchema)
    expect(fake.tokensIssued).toBe(1)
    expect(client.requestCount).toBe(2)
  })

  it('renews the token once on 401 and retries 429 and 5xx', async () => {
    const fake = new FakeIgdb([fakeGame(1)], [])
    const client = fake.client()
    fake.failures = [401, 429, 503]
    expect(await client.query('games', 'fields id; where id = (1);', idSchema)).toEqual([{ id: 1 }])
    expect(fake.tokensIssued).toBe(2)
    expect(fake.requests).toHaveLength(4)
  })

  it('reports refused queries and refused credentials', async () => {
    const fake = new FakeIgdb([], [])
    fake.failures = [400]
    await expect(fake.client().query('games', 'bad;', idSchema)).rejects.toBeInstanceOf(IgdbError)

    const refused = new IgdbClient(
      { clientId: 'x', clientSecret: 'y' },
      { fetch: async () => new Response('{}', { status: 403 }), sleep: async () => {} },
    )
    await expect(refused.query('games', 'fields id;', idSchema)).rejects.toThrow(
      /IGDB_CLIENT_ID and IGDB_CLIENT_SECRET/,
    )
  })
})
