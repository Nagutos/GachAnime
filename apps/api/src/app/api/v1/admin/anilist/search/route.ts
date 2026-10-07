import { media } from '@gachanime/db'
import { searchAniListMedia } from '@gachanime/importer'
import { anilistSearchQuerySchema, type AniListSearchResult } from '@gachanime/shared'
import { inArray } from 'drizzle-orm'
import { adminRoute, parseQuery } from '@/lib/admin'
import { callAniList, getAniListClient } from '@/lib/anilist'
import { getDb } from '@/lib/db'

export const GET = adminRoute(async ({ request }) => {
  const { q } = parseQuery(request, anilistSearchQuerySchema)
  const hits = await callAniList(() => searchAniListMedia(getAniListClient(), q))
  const imported = hits.length
    ? await getDb()
        .select({ anilistId: media.anilistId, seriesId: media.seriesId })
        .from(media)
        .where(
          inArray(
            media.anilistId,
            hits.map((hit) => hit.anilistId),
          ),
        )
    : []
  const seriesByAnilistId = new Map(imported.map((row) => [row.anilistId, row.seriesId]))
  const results: AniListSearchResult[] = hits.map((hit) => ({
    ...hit,
    importedSeriesId: seriesByAnilistId.get(hit.anilistId) ?? null,
  }))
  return Response.json({ results })
}, 'adminAniList')
