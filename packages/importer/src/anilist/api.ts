import type { AniListFilters } from '@gachanime/shared'
import type { AdultFilter } from '../mapping'
import type { AniListClient } from './client'
import {
  CHARACTERS_PER_PAGE,
  MEDIA_BATCH_QUERY,
  MEDIA_BATCH_SIZE,
  MEDIA_CHARACTERS_QUERY,
  MEDIA_FILTERS_QUERY,
  SEARCH_MEDIA_QUERY,
  TOP_MEDIA_QUERY,
  mediaBatchResponseSchema,
  mediaCharactersResponseSchema,
  mediaFiltersResponseSchema,
  searchMediaResponseSchema,
  topMediaResponseSchema,
  type AniListCharacterConnection,
  type AniListMedia,
} from './queries'

/** The only adult genre: AniList flags tags, not genres. */
const ADULT_GENRE = 'Hentai'

/**
 * Adult media are excluded unless allowed. The variable is then left out: AniList ignores an
 * omitted argument but treats `null` as a filter that matches nothing.
 */
function adultVariable({ allowAdult = false }: AdultFilter): { isAdult?: false } {
  return allowAdult ? {} : { isAdult: false }
}

export interface TopMediaFilter extends AdultFilter {
  /** Only anime with one of these genres (empty or absent = any). */
  genres?: readonly string[]
  /** Only anime with one of these tags (empty or absent = any). */
  tags?: readonly string[]
}

/** AniList ids of the `top` most popular anime (non-adult unless allowed), optionally filtered. */
export async function fetchTopMediaIds(
  client: AniListClient,
  top: number,
  filter: TopMediaFilter = {},
): Promise<number[]> {
  // Empty lists are left out: like `isAdult`, a null or empty filter would not mean "any".
  const variables = {
    ...adultVariable(filter),
    ...(filter.genres?.length ? { genres: filter.genres } : {}),
    ...(filter.tags?.length ? { tags: filter.tags } : {}),
  }
  const ids: number[] = []
  for (let page = 1; ids.length < top; page += 1) {
    const data = await client.query(
      TOP_MEDIA_QUERY,
      { page, perPage: MEDIA_BATCH_SIZE, ...variables },
      topMediaResponseSchema,
    )
    ids.push(...data.Page.media.map((media) => media.id))
    if (!data.Page.pageInfo.hasNextPage || data.Page.media.length === 0) break
  }
  return [...new Set(ids)].slice(0, top)
}

/** Full media records (≤ 50 ids). Unknown ids are simply absent from the result. */
export async function fetchMediaBatch(
  client: AniListClient,
  ids: number[],
): Promise<AniListMedia[]> {
  if (ids.length === 0) return []
  if (ids.length > MEDIA_BATCH_SIZE) throw new Error(`At most ${MEDIA_BATCH_SIZE} ids per batch`)
  const data = await client.query(
    MEDIA_BATCH_QUERY,
    { ids, perPage: MEDIA_BATCH_SIZE, charactersPerPage: CHARACTERS_PER_PAGE },
    mediaBatchResponseSchema,
  )
  return data.Page.media
}

/** One page of a media's characters, or null if the media no longer exists. */
export async function fetchMediaCharactersPage(
  client: AniListClient,
  anilistId: number,
  page: number,
): Promise<AniListCharacterConnection | null> {
  const data = await client.query(
    MEDIA_CHARACTERS_QUERY,
    { id: anilistId, page, perPage: CHARACTERS_PER_PAGE },
    mediaCharactersResponseSchema,
  )
  return data.Media?.characters ?? null
}

export interface AniListSearchHit {
  anilistId: number
  title: string
  titleEnglish: string | null
  format: string | null
  seasonYear: number | null
  popularity: number
  coverUrl: string | null
}

export async function searchAniListMedia(
  client: AniListClient,
  search: string,
  filter: AdultFilter = {},
): Promise<AniListSearchHit[]> {
  const data = await client.query(
    SEARCH_MEDIA_QUERY,
    { search, perPage: 20, ...adultVariable(filter) },
    searchMediaResponseSchema,
  )
  return data.Page.media.map((media) => ({
    anilistId: media.id,
    title: media.title.romaji ?? media.title.english ?? media.title.native ?? String(media.id),
    titleEnglish: media.title.english,
    format: media.format,
    seasonYear: media.seasonYear,
    popularity: media.popularity ?? 0,
    coverUrl: media.coverImage?.large ?? null,
  }))
}

/** Genres and tags offered by AniList, without adult ones unless allowed, sorted by name. */
export async function fetchMediaFilters(
  client: AniListClient,
  { allowAdult = false }: AdultFilter = {},
): Promise<AniListFilters> {
  const data = await client.query(MEDIA_FILTERS_QUERY, {}, mediaFiltersResponseSchema)
  const byName = (a: string, b: string) => a.localeCompare(b)
  return {
    genres: data.GenreCollection.filter(
      (genre): genre is string => Boolean(genre) && (allowAdult || genre !== ADULT_GENRE),
    ).sort(byName),
    tags: data.MediaTagCollection.filter((tag) => allowAdult || !tag.isAdult)
      .map((tag) => ({ name: tag.name, category: tag.category ?? '' }))
      .sort((a, b) => byName(a.name, b.name)),
  }
}
