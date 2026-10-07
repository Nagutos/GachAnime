import { z } from 'zod'

/*
 * AniList GraphQL queries and the Zod schemas validating their `data`. AniList limits nested
 * connections to 25 items per page, top-level pages to 50.
 */

export const MEDIA_BATCH_SIZE = 50
export const CHARACTERS_PER_PAGE = 25

const titleSchema = z.object({
  romaji: z.string().nullable(),
  english: z.string().nullable(),
  native: z.string().nullable(),
})

export const anilistCharacterSchema = z.object({
  id: z.number().int(),
  name: z.object({
    full: z.string().nullable(),
    native: z.string().nullable(),
    alternative: z.array(z.string().nullable()).nullable(),
  }),
  description: z.string().nullable(),
  image: z.object({ large: z.string().nullable() }).nullable(),
  gender: z.string().nullable(),
  favourites: z.number().int().nullable(),
})
export type AniListCharacter = z.infer<typeof anilistCharacterSchema>

export const characterConnectionSchema = z.object({
  pageInfo: z.object({ hasNextPage: z.boolean().nullable() }),
  edges: z.array(
    z.object({
      role: z.enum(['MAIN', 'SUPPORTING', 'BACKGROUND']).nullable(),
      node: anilistCharacterSchema.nullable(),
    }),
  ),
})
export type AniListCharacterConnection = z.infer<typeof characterConnectionSchema>

export const anilistMediaSchema = z.object({
  id: z.number().int(),
  type: z.string().nullable(),
  format: z.string().nullable(),
  isAdult: z.boolean().nullable(),
  popularity: z.number().int().nullable(),
  favourites: z.number().int().nullable(),
  seasonYear: z.number().int().nullable(),
  siteUrl: z.string().nullable(),
  description: z.string().nullable(),
  genres: z.array(z.string().nullable()).nullable(),
  title: titleSchema,
  coverImage: z.object({ large: z.string().nullable() }).nullable(),
  tags: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        category: z.string().nullable(),
        rank: z.number().int().nullable(),
        isAdult: z.boolean().nullable(),
      }),
    )
    .nullable(),
  relations: z.object({
    edges: z.array(
      z.object({
        relationType: z.string().nullable(),
        node: z
          .object({
            id: z.number().int(),
            type: z.string().nullable(),
            format: z.string().nullable(),
            isAdult: z.boolean().nullable(),
          })
          .nullable(),
      }),
    ),
  }),
  characters: characterConnectionSchema,
})
export type AniListMedia = z.infer<typeof anilistMediaSchema>

const CHARACTER_FIELDS = `
  pageInfo { hasNextPage }
  edges {
    role
    node {
      id
      name { full native alternative }
      description
      image { large }
      gender
      favourites
    }
  }
`

export const TOP_MEDIA_QUERY = `
query TopMedia($page: Int!, $perPage: Int!) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id }
  }
}`

export const topMediaResponseSchema = z.object({
  Page: z.object({
    pageInfo: z.object({ hasNextPage: z.boolean().nullable() }),
    media: z.array(z.object({ id: z.number().int() })),
  }),
})

/** Media details, franchise relations, tags and the first page of characters, 50 at a time. */
export const MEDIA_BATCH_QUERY = `
query MediaBatch($ids: [Int], $perPage: Int!, $charactersPerPage: Int!) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME) {
      id type format isAdult popularity favourites seasonYear siteUrl genres
      description(asHtml: false)
      title { romaji english native }
      coverImage { large }
      tags { id name category rank isAdult }
      relations { edges { relationType node { id type format isAdult } } }
      characters(page: 1, perPage: $charactersPerPage, sort: [ROLE, RELEVANCE, ID]) {
        ${CHARACTER_FIELDS}
      }
    }
  }
}`

export const mediaBatchResponseSchema = z.object({
  Page: z.object({ media: z.array(anilistMediaSchema) }),
})

export const MEDIA_CHARACTERS_QUERY = `
query MediaCharacters($id: Int!, $page: Int!, $perPage: Int!) {
  Media(id: $id, type: ANIME) {
    characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE, ID]) {
      ${CHARACTER_FIELDS}
    }
  }
}`

export const mediaCharactersResponseSchema = z.object({
  Media: z.object({ characters: characterConnectionSchema }).nullable(),
})

export const SEARCH_MEDIA_QUERY = `
query SearchMedia($search: String!, $perPage: Int!) {
  Page(page: 1, perPage: $perPage) {
    media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
      id format seasonYear popularity
      title { romaji english native }
      coverImage { large }
    }
  }
}`

export const searchMediaResponseSchema = z.object({
  Page: z.object({
    media: z.array(
      z.object({
        id: z.number().int(),
        format: z.string().nullable(),
        seasonYear: z.number().int().nullable(),
        popularity: z.number().int().nullable(),
        title: titleSchema,
        coverImage: z.object({ large: z.string().nullable() }).nullable(),
      }),
    ),
  }),
})
