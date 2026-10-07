import { media, series, seriesCharacters, type Executor } from '@gachanime/db'
import { slugify } from '@gachanime/shared'
import { and, eq, inArray, sql } from 'drizzle-orm'

/**
 * Rebuilds the canonical membership of AniList series from `character_media`.
 * Manual series are left untouched (their membership is edited directly).
 */
export async function rebuildSeriesCharacters(db: Executor, seriesIds: number[]): Promise<void> {
  const ids = [...new Set(seriesIds)]
  if (ids.length === 0) return
  const anilistSeries = await db
    .select({ id: series.id })
    .from(series)
    .where(and(inArray(series.id, ids), eq(series.source, 'anilist')))
  const targetIds = anilistSeries.map((row) => row.id)
  if (targetIds.length === 0) return

  await db.delete(seriesCharacters).where(inArray(seriesCharacters.seriesId, targetIds))
  await db.execute(sql`
    INSERT INTO series_characters (series_id, character_id)
    SELECT DISTINCT m.series_id, cm.character_id
    FROM character_media cm
    JOIN media m ON m.id = cm.media_id
    WHERE m.series_id IN ${targetIds}
    ON CONFLICT DO NOTHING
  `)
}

/**
 * Refreshes AniList series metadata from their most popular media: primary media, title, cover,
 * description and popularity.
 */
export async function refreshAniListSeries(db: Executor, seriesIds: number[]): Promise<void> {
  const ids = [...new Set(seriesIds)]
  if (ids.length === 0) return
  await db.execute(sql`
    UPDATE series s SET
      primary_media_id = p.id,
      title = p.title_romaji,
      title_english = p.title_english,
      cover_url = p.cover_url,
      description = p.description,
      popularity = p.popularity,
      updated_at = now()
    FROM (
      SELECT DISTINCT ON (m.series_id) m.series_id, m.id, m.title_romaji, m.title_english,
        m.cover_url, m.description, m.popularity
      FROM media m
      WHERE m.series_id IN ${ids}
      ORDER BY m.series_id, m.popularity DESC, m.anilist_id
    ) p
    WHERE s.id = p.series_id AND s.source = 'anilist'
  `)
}

/** A slug not used by any series yet, derived from `title` (`fallback` when it has no ASCII). */
export async function uniqueSeriesSlug(
  db: Executor,
  title: string,
  fallback: string,
): Promise<string> {
  const base = slugify(title) || slugify(fallback) || 'series'
  for (let attempt = 1; ; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`
    const [taken] = await db
      .select({ id: series.id })
      .from(series)
      .where(eq(series.slug, candidate))
      .limit(1)
    if (!taken) return candidate
  }
}

/** Series ids of the given media. */
export async function seriesIdsOfMedia(db: Executor, mediaIds: number[]): Promise<number[]> {
  if (mediaIds.length === 0) return []
  const rows = await db
    .selectDistinct({ seriesId: media.seriesId })
    .from(media)
    .where(inArray(media.id, mediaIds))
  return rows.map((row) => row.seriesId).filter((id): id is number => id !== null)
}
