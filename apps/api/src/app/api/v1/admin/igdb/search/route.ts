import { igdbGames } from '@gachanime/db'
import { igdbImageUrl, searchGames } from '@gachanime/importer'
import { igdbSearchQuerySchema, type IgdbSearchResult } from '@gachanime/shared'
import { inArray } from 'drizzle-orm'
import { adminRoute, parseQuery } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { callIgdb, getIgdbClient } from '@/lib/igdb'

/** Video games on IGDB, to pick games to import. */
export const GET = adminRoute(async ({ request }) => {
  const { q } = parseQuery(request, igdbSearchQuerySchema)
  const hits = await callIgdb(() => searchGames(getIgdbClient(), q))
  const imported = hits.length
    ? await getDb()
        .select({ igdbId: igdbGames.igdbId, seriesId: igdbGames.seriesId })
        .from(igdbGames)
        .where(
          inArray(
            igdbGames.igdbId,
            hits.map((hit) => hit.id),
          ),
        )
    : []
  const seriesByIgdbId = new Map(imported.map((row) => [row.igdbId, row.seriesId]))
  const results: IgdbSearchResult[] = hits.map((hit) => ({
    igdbId: hit.id,
    name: hit.name,
    releaseYear: hit.first_release_date
      ? new Date(hit.first_release_date * 1000).getUTCFullYear()
      : null,
    ratingCount: Math.round(hit.total_rating_count ?? 0),
    coverUrl: hit.cover ? igdbImageUrl(hit.cover.image_id, 'cover_small') : null,
    siteUrl: hit.url ?? null,
    importedSeriesId: seriesByIgdbId.get(hit.id) ?? null,
  }))
  return Response.json({ results })
}, 'adminAniList')
