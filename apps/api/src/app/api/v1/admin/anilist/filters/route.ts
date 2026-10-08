import { getSetting } from '@gachanime/core'
import { fetchMediaFilters } from '@gachanime/importer'
import type { AniListFilters } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { callAniList, getAniListClient } from '@/lib/anilist'
import { getDb } from '@/lib/db'

/** Genres and tags a top import can be restricted to. */
export const GET = adminRoute(async () => {
  const { allowed } = await getSetting(getDb(), 'imports.adult')
  const filters: AniListFilters = await callAniList(() =>
    fetchMediaFilters(getAniListClient(), { allowAdult: allowed }),
  )
  return Response.json(filters)
}, 'adminAniList')
