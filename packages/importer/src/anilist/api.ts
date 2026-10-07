import type { AniListClient } from './client'
import {
  CHARACTERS_PER_PAGE,
  MEDIA_BATCH_QUERY,
  MEDIA_BATCH_SIZE,
  MEDIA_CHARACTERS_QUERY,
  SEARCH_MEDIA_QUERY,
  TOP_MEDIA_QUERY,
  mediaBatchResponseSchema,
  mediaCharactersResponseSchema,
  searchMediaResponseSchema,
  topMediaResponseSchema,
  type AniListCharacterConnection,
  type AniListMedia,
} from './queries'

/** AniList ids of the `top` most popular non-adult anime. */
export async function fetchTopMediaIds(client: AniListClient, top: number): Promise<number[]> {
  const ids: number[] = []
  for (let page = 1; ids.length < top; page += 1) {
    const data = await client.query(
      TOP_MEDIA_QUERY,
      { page, perPage: MEDIA_BATCH_SIZE },
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
): Promise<AniListSearchHit[]> {
  const data = await client.query(
    SEARCH_MEDIA_QUERY,
    { search, perPage: 20 },
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
