import { themes, type Database, type Executor } from '@gachanime/db'
import { themeRuleSchema, type ThemePreview, type ThemeRule } from '@gachanime/shared'
import { eq, isNull, sql } from 'drizzle-orm'
import { publicImageUrl } from '../catalog/images'
import { loadRarities } from '../catalog/rarities'
import { themeRuleSql } from './rules'

const drawable = sql`EXISTS (SELECT 1 FROM drawable_characters d WHERE d.character_id = c.id)`

/** Rebuilds the materialized membership of one pack (drawable characters matching its rules). */
export async function rebuildThemePool(tx: Executor, themeId: number): Promise<number> {
  const [theme] = await tx
    .select({ rules: themes.rules })
    .from(themes)
    .where(eq(themes.id, themeId))
    .for('update')
  if (!theme) return 0
  const rules = themeRuleSchema.parse(theme.rules)
  await tx.execute(sql`DELETE FROM theme_characters WHERE theme_id = ${themeId}`)
  const result = await tx.execute(sql`
    INSERT INTO theme_characters (theme_id, character_id)
    SELECT ${themeId}, c.id FROM characters c WHERE ${drawable} AND (${themeRuleSql(rules)})`)
  await tx.update(themes).set({ poolBuiltAt: new Date() }).where(eq(themes.id, themeId))
  return result.rowCount ?? 0
}

/** Every pack, each in its own transaction (worker job after catalog changes and imports). */
export async function rebuildAllThemePools(database: Database): Promise<number> {
  const rows = await database.select({ id: themes.id }).from(themes)
  for (const row of rows) {
    await database.transaction((tx) => rebuildThemePool(tx, row.id))
  }
  return rows.length
}

/** Builds the pools never built yet (new packs from the seed). */
export async function ensureThemePools(database: Database): Promise<void> {
  const rows = await database
    .select({ id: themes.id })
    .from(themes)
    .where(isNull(themes.poolBuiltAt))
  for (const row of rows) {
    await database.transaction((tx) => rebuildThemePool(tx, row.id))
  }
}

/** What a pack would contain with these rules (admin live preview). */
export async function previewTheme(db: Executor, rules: ThemeRule): Promise<ThemePreview> {
  const condition = sql`${drawable} AND (${themeRuleSql(rules)})`
  const [rarityRows, counts, seriesRows, samples] = await Promise.all([
    loadRarities(db),
    db.execute<{ rarity_key: string; count: number }>(sql`
      SELECT r.key AS rarity_key, count(*)::int AS count
      FROM characters c JOIN rarities r ON r.id = c.rarity_id
      WHERE ${condition} GROUP BY r.key`),
    db.execute<{ id: string; title: string; count: number }>(sql`
      SELECT s.id, s.title, count(*)::int AS count
      FROM characters c
      JOIN series_characters sc ON sc.character_id = c.id
      JOIN series s ON s.id = sc.series_id AND s.is_active
      WHERE ${condition}
      GROUP BY s.id
      ORDER BY count DESC, s.popularity DESC, s.id`),
    db.execute<{
      id: string
      name: string
      image_url: string | null
      image_path: string | null
      rarity_key: string
    }>(sql`
      SELECT c.id, c.name_full AS name, c.image_url, c.image_path, r.key AS rarity_key
      FROM characters c JOIN rarities r ON r.id = c.rarity_id
      WHERE ${condition}
      ORDER BY r.sort_order DESC, c.favourites DESC NULLS LAST, c.id
      LIMIT 12`),
  ])
  const countByRarity = new Map(counts.rows.map((row) => [row.rarity_key, Number(row.count)]))
  const byRarity = rarityRows.map((rarity) => ({
    rarityKey: rarity.key,
    count: countByRarity.get(rarity.key) ?? 0,
  }))
  return {
    total: byRarity.reduce((sum, row) => sum + row.count, 0),
    byRarity,
    emptyRarities: byRarity.filter((row) => row.count === 0).map((row) => row.rarityKey),
    series: seriesRows.rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      count: Number(row.count),
    })),
    samples: samples.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      imageUrl: publicImageUrl(row.image_path, row.image_url),
      rarityKey: row.rarity_key,
    })),
  }
}
