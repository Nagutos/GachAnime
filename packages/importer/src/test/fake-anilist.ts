import type { AniListCharacter, AniListMedia } from '../anilist/queries'
import { AniListClient } from '../anilist/client'

export interface FakeMedia {
  id: number
  title: string
  popularity: number
  format?: string
  type?: string
  isAdult?: boolean
  relations?: { id: number; type: string; relationType: string; isAdult?: boolean }[]
  characters: { character: AniListCharacter; role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND' }[]
}

export function fakeCharacter(
  id: number,
  overrides: Partial<AniListCharacter> = {},
): AniListCharacter {
  return {
    id,
    name: { full: `Character ${id}`, native: null, alternative: [] },
    description: null,
    image: { large: `https://img.test/character/${id}.png` },
    gender: id % 2 === 0 ? 'Female' : 'Male',
    favourites: 10,
    ...overrides,
  }
}

/**
 * In-memory AniList answering the importer's queries (operation names TopMedia, MediaBatch,
 * MediaCharacters). `onRequest` can inject failures.
 */
export class FakeAniList {
  readonly calls: { operation: string; variables: Record<string, unknown> }[] = []
  onRequest?: (operation: string, variables: Record<string, unknown>) => void | Promise<void>

  constructor(
    public media: FakeMedia[],
    public top: number[],
  ) {}

  client(): AniListClient {
    return new AniListClient({
      fetch: (_url, init) => this.handle(init),
      sleep: async () => {},
      requestsPerMinute: 1_000_000,
    })
  }

  count(operation: string): number {
    return this.calls.filter((call) => call.operation === operation).length
  }

  private async handle(init: RequestInit | undefined): Promise<Response> {
    const { query, variables } = JSON.parse(String(init?.body)) as {
      query: string
      variables: Record<string, unknown>
    }
    const operation = /query (\w+)/.exec(query)?.[1] ?? 'unknown'
    this.calls.push({ operation, variables })
    await this.onRequest?.(operation, variables)
    return Response.json({ data: this.answer(operation, variables) })
  }

  private answer(operation: string, variables: Record<string, unknown>): unknown {
    switch (operation) {
      case 'TopMedia': {
        const page = variables.page as number
        const perPage = variables.perPage as number
        const ids = this.top.slice((page - 1) * perPage, page * perPage)
        return {
          Page: {
            pageInfo: { hasNextPage: page * perPage < this.top.length },
            media: ids.map((id) => ({ id })),
          },
        }
      }
      case 'MediaBatch': {
        const ids = variables.ids as number[]
        const perPage = variables.charactersPerPage as number
        const found = this.media.filter((media) => ids.includes(media.id))
        return { Page: { media: found.map((media) => this.toMedia(media, 1, perPage)) } }
      }
      case 'MediaCharacters': {
        const media = this.media.find((item) => item.id === variables.id)
        if (!media) return { Media: null }
        const page = this.toMedia(media, variables.page as number, variables.perPage as number)
        return { Media: { characters: page.characters } }
      }
      default:
        throw new Error(`Unexpected operation ${operation}`)
    }
  }

  private toMedia(media: FakeMedia, page: number, perPage: number): AniListMedia {
    const slice = media.characters.slice((page - 1) * perPage, page * perPage)
    return {
      id: media.id,
      type: media.type ?? 'ANIME',
      format: media.format ?? 'TV',
      isAdult: media.isAdult ?? false,
      popularity: media.popularity,
      favourites: 0,
      seasonYear: 2020,
      siteUrl: `https://anilist.co/anime/${media.id}`,
      description: `About ${media.title}`,
      genres: ['Action'],
      title: { romaji: media.title, english: null, native: null },
      coverImage: { large: `https://img.test/media/${media.id}.jpg` },
      tags: [{ id: 1, name: 'Shounen', category: 'Demographic', rank: 80, isAdult: false }],
      relations: {
        edges: (media.relations ?? []).map((relation) => ({
          relationType: relation.relationType,
          node: {
            id: relation.id,
            type: relation.type,
            format: 'TV',
            isAdult: relation.isAdult ?? false,
          },
        })),
      },
      characters: {
        pageInfo: { hasNextPage: page * perPage < media.characters.length },
        edges: slice.map(({ character, role }) => ({ role, node: character })),
      },
    }
  }
}
