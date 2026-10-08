import { z } from 'zod'
import type { IgdbClient } from './client'

/** IGDB returns at most 500 rows per query. */
export const IGDB_PAGE_SIZE = 500
/** Games per character query (`where games = (…)`), keeping the query short. */
export const IGDB_GAMES_PER_CHARACTER_QUERY = 10

const named = z.object({ id: z.number().int(), name: z.string() })

export const igdbGameSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  summary: z.string().optional(),
  url: z.string().optional(),
  total_rating_count: z.number().optional(),
  first_release_date: z.number().optional(),
  cover: z.object({ image_id: z.string() }).optional(),
  genres: z.array(named).optional(),
  themes: z.array(named).optional(),
  /** A game's series (e.g. "The Legend of Zelda"); the first one groups it into a series. */
  collections: z.array(named).optional(),
})
export type IgdbGame = z.infer<typeof igdbGameSchema>

export const igdbCharacterSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  akas: z.array(z.string()).optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  /** Deprecated enum (0 male, 1 female, 2 other), still filled on many characters. */
  gender: z.number().int().optional(),
  character_gender: z.object({ name: z.string() }).optional(),
  mug_shot: z.object({ image_id: z.string() }).optional(),
  games: z.array(z.number().int()).optional(),
})
export type IgdbCharacter = z.infer<typeof igdbCharacterSchema>

export const igdbSearchResultSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  url: z.string().optional(),
  total_rating_count: z.number().optional(),
  first_release_date: z.number().optional(),
  cover: z.object({ image_id: z.string() }).optional(),
})
export type IgdbSearchResult = z.infer<typeof igdbSearchResultSchema>

const idOnly = z.object({ id: z.number().int() })

/** Image of the IGDB CDN; `cover_big_2x` (528×748) fits a card. */
export function igdbImageUrl(imageId: string, size = 'cover_big_2x'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`
}

/** Main games only: no DLC, expansion or edition (they have a parent / version parent). */
const MAIN_GAMES = 'parent_game = null & version_parent = null'

/** Ids of the `top` most rated main games, most rated first. */
export async function fetchTopGameIds(client: IgdbClient, top: number): Promise<number[]> {
  const ids: number[] = []
  for (let offset = 0; offset < top; offset += IGDB_PAGE_SIZE) {
    const limit = Math.min(IGDB_PAGE_SIZE, top - offset)
    const page = await client.query(
      'games',
      `fields id; where total_rating_count != null & ${MAIN_GAMES}; ` +
        `sort total_rating_count desc; limit ${limit}; offset ${offset};`,
      idOnly,
    )
    ids.push(...page.map((game) => game.id))
    if (page.length < limit) break
  }
  return ids
}

const GAME_FIELDS =
  'name,summary,url,total_rating_count,first_release_date,cover.image_id,' +
  'genres.name,themes.name,collections.name'

/** Full records of the given games (any order). */
export async function fetchGames(client: IgdbClient, ids: number[]): Promise<IgdbGame[]> {
  const games: IgdbGame[] = []
  for (let start = 0; start < ids.length; start += IGDB_PAGE_SIZE) {
    const batch = ids.slice(start, start + IGDB_PAGE_SIZE)
    games.push(
      ...(await client.query(
        'games',
        `fields ${GAME_FIELDS}; where id = (${batch.join(',')}); limit ${IGDB_PAGE_SIZE};`,
        igdbGameSchema,
      )),
    )
  }
  return games
}

const CHARACTER_FIELDS =
  'name,akas,description,url,gender,character_gender.name,mug_shot.image_id,games'

/**
 * Characters with a portrait appearing in any of the given games, one page at a time
 * (characters without a portrait are never imported, as with AniList).
 */
export async function fetchGameCharactersPage(
  client: IgdbClient,
  gameIds: number[],
  offset: number,
): Promise<IgdbCharacter[]> {
  return client.query(
    'characters',
    `fields ${CHARACTER_FIELDS}; where games = (${gameIds.join(',')}) & mug_shot != null; ` +
      `sort id asc; limit ${IGDB_PAGE_SIZE}; offset ${offset};`,
    igdbCharacterSchema,
  )
}

/** Games matching a name, for the admin search (main games, most rated first). */
export async function searchGames(client: IgdbClient, text: string): Promise<IgdbSearchResult[]> {
  const escaped = text.replaceAll('\\', ' ').replaceAll('"', ' ').trim()
  const results = await client.query(
    'games',
    `search "${escaped}"; fields name,url,total_rating_count,first_release_date,cover.image_id; ` +
      `where ${MAIN_GAMES}; limit 20;`,
    igdbSearchResultSchema,
  )
  return results.sort((a, b) => (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0))
}
