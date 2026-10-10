import { themes, type Executor } from '@gachanime/db'
import type { PoolSeriesResponse } from '@gachanime/shared'
import { and, eq, sql } from 'drizzle-orm'
import { publicImageUrl } from '../catalog/images'
import { AppError } from '../errors'

/**
 * Active series of a booster pool with how many of their drawable characters it holds and how
 * many the player owns (preview before opening). No pack = the whole catalog (paid tiers too).
 */
export async function listPoolSeries(
  db: Executor,
  userId: string,
  themeKey: string | null,
): Promise<PoolSeriesResponse> {
  let packJoin = sql``
  if (themeKey !== null) {
    const [theme] = await db
      .select({ id: themes.id })
      .from(themes)
      .where(and(eq(themes.key, themeKey), eq(themes.isActive, true)))
    if (!theme) throw new AppError('THEME_UNAVAILABLE', `Pack "${themeKey}" is not available`)
    packJoin = sql`JOIN theme_characters tc
      ON tc.character_id = d.character_id AND tc.theme_id = ${theme.id}`
  }
  const result = await db.execute<{
    id: string
    title: string
    cover_url: string | null
    cover_upload_path: string | null
    characters: number
    owned: number
  }>(sql`
    SELECT s.id, s.title, s.cover_url, s.cover_upload_path,
      count(*)::int AS characters,
      (count(uc.character_id) FILTER (WHERE uc.quantity > 0))::int AS owned
    FROM drawable_characters d
    ${packJoin}
    JOIN series_characters sc ON sc.character_id = d.character_id
    JOIN series s ON s.id = sc.series_id AND s.is_active
    LEFT JOIN user_cards uc ON uc.character_id = d.character_id AND uc.user_id = ${userId}
    GROUP BY s.id
    ORDER BY s.popularity DESC, s.id`)
  return {
    series: result.rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      coverUrl: publicImageUrl(row.cover_upload_path, row.cover_url),
      characters: Number(row.characters),
      owned: Number(row.owned),
    })),
  }
}
