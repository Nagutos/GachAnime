import { igdbGames, media, series, seriesCharacters, type Executor } from '@gachanime/db'
import { slugify } from '@gachanime/shared'
import { and, eq, inArray, sql } from 'drizzle-orm'

/**
 * Rebuilds the canonical membership of imported series: AniList series from `character_media`,
 * IGDB series from `character_games`. Manual series are left untouched (edited directly).
 */
export async function rebuildSeriesCharacters(db: Executor, seriesIds: number[]): Promise<void> {
  const ids = [...new Set(seriesIds)]
  if (ids.length === 0) return
  const imported = await db
    .select({ id: series.id, source: series.source })
    .from(series)
    .where(and(inArray(series.id, ids), inArray(series.source, ['anilist', 'igdb'])))
  const targetIds = imported.map((row) => row.id)
  if (targetIds.length === 0) return

  await db.delete(seriesCharacters).where(inArray(seriesCharacters.seriesId, targetIds))
  await db.execute(sql`
    INSERT INTO series_characters (series_id, character_id)
    SELECT DISTINCT m.series_id, cm.character_id
    FROM character_media cm
    JOIN media m ON m.id = cm.media_id
    WHERE m.series_id IN ${targetIds}
    UNION
    SELECT DISTINCT g.series_id, cg.character_id
    FROM character_games cg
    JOIN igdb_games g ON g.id = cg.game_id
    WHERE g.series_id IN ${targetIds}
    ON CONFLICT DO NOTHING
  `)
}

/**
 * Refreshes IGDB series metadata from their games: cover and description of the most popular
 * game, genres of all games, popularity = rating count of the most popular game. Collections
 * keep their own name; single-game series take the game name.
 */
export async function refreshIgdbSeries(db: Executor, seriesIds: number[]): Promise<void> {
  const ids = [...new Set(seriesIds)]
  if (ids.length === 0) return
  await db.execute(sql`
    UPDATE series s SET
      title = CASE WHEN s.igdb_key LIKE 'game:%' THEN p.name ELSE s.title END,
      cover_url = p.cover_url,
      description = coalesce(s.description, p.summary),
      popularity = p.rating_count,
      genres = coalesce((SELECT array_agg(DISTINCT genre ORDER BY genre)
        FROM igdb_games g, unnest(g.genres) AS genre WHERE g.series_id = s.id), '{}'),
      updated_at = now()
    FROM (
      SELECT DISTINCT ON (g.series_id) g.series_id, g.name, g.cover_url, g.summary, g.rating_count
      FROM igdb_games g
      WHERE g.series_id IN ${ids}
      ORDER BY g.series_id, g.rating_count DESC, g.igdb_id
    ) p
    WHERE s.id = p.series_id AND s.source = 'igdb'
  `)
}

/** Series ids of the given IGDB games. */
export async function seriesIdsOfGames(db: Executor, gameIds: number[]): Promise<number[]> {
  if (gameIds.length === 0) return []
  const rows = await db
    .selectDistinct({ seriesId: igdbGames.seriesId })
    .from(igdbGames)
    .where(inArray(igdbGames.id, gameIds))
  return rows.map((row) => row.seriesId)
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
