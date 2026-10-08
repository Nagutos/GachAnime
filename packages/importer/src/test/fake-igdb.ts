import type { IgdbCharacter, IgdbGame } from '../igdb/api'
import { IgdbClient } from '../igdb/client'

/**
 * In-memory IGDB answering the Apicalypse queries the importer sends (through a fake `fetch`),
 * with a Twitch token endpoint. Honors `where id = (…)`, `where games = (…) & mug_shot != null`,
 * the top-games sort, `limit` and `offset`.
 */
export class FakeIgdb {
  requests: { resource: string; body: string }[] = []
  tokensIssued = 0
  /** Next responses forced on the API (status codes), consumed in order. */
  failures: number[] = []

  constructor(
    readonly games: IgdbGame[],
    readonly characters: IgdbCharacter[],
  ) {}

  client(): IgdbClient {
    return new IgdbClient(
      { clientId: 'client', clientSecret: 'secret' },
      { fetch: this.fetch, sleep: async () => {}, endpoint: 'https://igdb.test/v4' },
    )
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname === 'id.twitch.tv') {
      this.tokensIssued += 1
      return Response.json({ access_token: `token-${this.tokensIssued}`, expires_in: 3600 })
    }
    const resource = url.pathname.split('/').pop()!
    const body = String(init?.body)
    this.requests.push({ resource, body })
    const forced = this.failures.shift()
    if (forced) return new Response('forced', { status: forced })

    const limit = Number(/limit (\d+)/.exec(body)?.[1] ?? 10)
    const offset = Number(/offset (\d+)/.exec(body)?.[1] ?? 0)
    const ids = (pattern: RegExp) =>
      (pattern.exec(body)?.[1] ?? '').split(',').filter(Boolean).map(Number)

    if (resource === 'games') {
      if (body.includes('sort total_rating_count desc')) {
        const top = [...this.games]
          .sort((a, b) => (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0))
          .slice(offset, offset + limit)
        return Response.json(top.map((game) => ({ id: game.id })))
      }
      const wanted = new Set(ids(/where id = \(([\d,]+)\)/))
      return Response.json(this.games.filter((game) => wanted.has(game.id)))
    }
    if (resource === 'characters') {
      const wanted = new Set(ids(/where games = \(([\d,]+)\)/))
      const matching = this.characters
        .filter((character) => character.games?.some((game) => wanted.has(game)))
        .filter((character) => !body.includes('mug_shot != null') || character.mug_shot)
        .sort((a, b) => a.id - b.id)
      return Response.json(matching.slice(offset, offset + limit))
    }
    return new Response('unknown resource', { status: 404 })
  }
}

export function fakeGame(id: number, overrides: Partial<IgdbGame> = {}): IgdbGame {
  return {
    id,
    name: `Game ${id}`,
    summary: `Summary of game ${id}.`,
    url: `https://www.igdb.com/games/game-${id}`,
    total_rating_count: 100,
    first_release_date: 1_500_000_000,
    cover: { image_id: `cover${id}` },
    genres: [{ id: 1, name: 'Adventure' }],
    themes: [{ id: 2, name: 'Fantasy' }],
    ...overrides,
  }
}

export function fakeGameCharacter(
  id: number,
  games: number[],
  overrides: Partial<IgdbCharacter> = {},
): IgdbCharacter {
  return {
    id,
    name: `Hero ${id}`,
    url: `https://www.igdb.com/characters/hero-${id}`,
    character_gender: { name: id % 2 === 0 ? 'Male' : 'Female' },
    mug_shot: { image_id: `mug${id}` },
    games,
    ...overrides,
  }
}
