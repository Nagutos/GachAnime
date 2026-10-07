import type { ThemeRule } from '@gachanime/shared'
import { sql, type SQL } from 'drizzle-orm'

/** Active series of the character `c`, joined as `s` (series-level rules). */
const inActiveSeries = (condition: SQL) => sql`EXISTS (
  SELECT 1 FROM series_characters sc JOIN series s ON s.id = sc.series_id
  WHERE sc.character_id = c.id AND s.is_active AND ${condition})`

/**
 * Compiles a pack rule into a condition on the characters table aliased `c` (GAME_DESIGN §5).
 * Series-level rules match when any active series of the character matches, through any of its
 * media (AniList) or its own genres (manual series).
 */
export function themeRuleSql(rule: ThemeRule): SQL {
  switch (rule.type) {
    case 'group': {
      if (rule.rules.length === 0) return rule.mode === 'all' ? sql`TRUE` : sql`FALSE`
      const parts = rule.rules.map((child) => sql`(${themeRuleSql(child)})`)
      return sql.join(parts, rule.mode === 'all' ? sql` AND ` : sql` OR `)
    }
    case 'gender':
      return sql`coalesce(c.gender_override, c.gender_class) = ${rule.gender}`
    case 'series_kind':
      return inActiveSeries(sql`s.kind = ${rule.kind}`)
    case 'series':
      return inActiveSeries(
        sql`s.id IN (${sql.join(
          rule.seriesIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
    case 'genre':
      return inActiveSeries(sql`(${rule.genre} = ANY(s.genres) OR EXISTS (
        SELECT 1 FROM media m WHERE m.series_id = s.id AND ${rule.genre} = ANY(m.genres)))`)
    case 'media_format':
      return inActiveSeries(
        sql`EXISTS (SELECT 1 FROM media m WHERE m.series_id = s.id AND m.format = ${rule.format})`,
      )
    case 'tag':
      return inActiveSeries(sql`EXISTS (
        SELECT 1 FROM media m
        JOIN media_tags mt ON mt.media_id = m.id
        JOIN anilist_tags t ON t.id = mt.tag_id
        WHERE m.series_id = s.id AND lower(t.name) = lower(${rule.tag}) AND mt.rank >= ${rule.minRank})`)
  }
}
