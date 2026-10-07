import { anilistTags, series, themes, type Database, type Executor } from '@gachanime/db'
import {
  localizedTextSchema,
  themeRuleSchema,
  type AdminTheme,
  type CreateThemeRequest,
  type ThemeRuleOptions,
  type UpdateThemeRequest,
} from '@gachanime/shared'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { recordAdminAction } from '../admin/audit'
import type { AdminActor } from '../catalog/admin-series'
import { AppError } from '../errors'
import { rebuildThemePool } from './pools'

/** Drawable characters in a pack's pool. */
export const themePoolSize = sql<number>`(SELECT count(*)::int FROM theme_characters tc
  JOIN drawable_characters d ON d.character_id = tc.character_id
  WHERE tc.theme_id = "themes"."id")`

export async function listAdminThemes(db: Executor): Promise<AdminTheme[]> {
  const rows = await db
    .select({ theme: themes, characterCount: themePoolSize })
    .from(themes)
    .orderBy(asc(themes.sortOrder), asc(themes.id))
  return rows.map(({ theme, characterCount }) => ({
    id: theme.id,
    key: theme.key,
    name: localizedTextSchema.parse(theme.name),
    description: theme.description ? localizedTextSchema.parse(theme.description) : null,
    category: theme.category,
    rules: themeRuleSchema.parse(theme.rules),
    freeEnabled: theme.freeEnabled,
    paidEnabled: theme.paidEnabled,
    surchargePercent: theme.surchargePercent,
    artToken: theme.artToken,
    isActive: theme.isActive,
    sortOrder: theme.sortOrder,
    poolBuiltAt: theme.poolBuiltAt?.toISOString() ?? null,
    characterCount,
    prices: {},
  }))
}

export async function createTheme(
  database: Database,
  input: CreateThemeRequest,
  actor: AdminActor,
): Promise<{ id: number }> {
  return database.transaction(async (tx) => {
    const [created] = await tx
      .insert(themes)
      .values({ ...input, description: input.description ?? null })
      .onConflictDoNothing()
      .returning()
    if (!created) throw new AppError('CONFLICT', `Pack "${input.key}" already exists`)
    const size = await rebuildThemePool(tx, created.id)
    await recordAdminAction(tx, {
      ...actor,
      action: 'theme.create',
      targetType: 'theme',
      targetId: String(created.id),
      after: { ...created, poolSize: size },
    })
    return { id: created.id }
  })
}

/** Saving a pack rebuilds its pool, so the shop and draws use the new rules at once. */
export async function updateTheme(
  database: Database,
  id: number,
  input: UpdateThemeRequest,
  actor: AdminActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [before] = await tx.select().from(themes).where(eq(themes.id, id)).for('update')
    if (!before) throw new AppError('NOT_FOUND', `Pack #${id} not found`)
    const [after] = await tx.update(themes).set(input).where(eq(themes.id, id)).returning()
    const poolSize = input.rules ? await rebuildThemePool(tx, id) : undefined
    await recordAdminAction(tx, {
      ...actor,
      action: 'theme.update',
      targetType: 'theme',
      targetId: String(id),
      before,
      after: { ...after, poolSize },
    })
  })
}

/** Past openings keep their history (their theme becomes null). */
export async function deleteTheme(
  database: Database,
  id: number,
  actor: AdminActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [deleted] = await tx.delete(themes).where(eq(themes.id, id)).returning()
    if (!deleted) throw new AppError('NOT_FOUND', `Pack #${id} not found`)
    await recordAdminAction(tx, {
      ...actor,
      action: 'theme.delete',
      targetType: 'theme',
      targetId: String(id),
      before: deleted,
    })
  })
}

/** Values offered by the rule builder: tags, genres and formats in the catalog, active series. */
export async function getThemeRuleOptions(db: Executor): Promise<ThemeRuleOptions> {
  const [tags, genres, formats, seriesRows] = await Promise.all([
    db
      .select({
        name: anilistTags.name,
        category: anilistTags.category,
        media: sql<number>`(SELECT count(*)::int FROM media_tags mt WHERE mt.tag_id = "anilist_tags"."id")`,
      })
      .from(anilistTags)
      .where(eq(anilistTags.isAdult, false))
      .orderBy(asc(anilistTags.name)),
    db.execute<{ genre: string }>(sql`
      SELECT DISTINCT g AS genre FROM (
        SELECT unnest(genres) AS g FROM media UNION SELECT unnest(genres) FROM series
      ) genres ORDER BY 1`),
    db.execute<{ format: string }>(
      sql`SELECT DISTINCT format FROM media WHERE format IS NOT NULL ORDER BY 1`,
    ),
    db
      .select({ id: series.id, title: series.title })
      .from(series)
      .where(eq(series.isActive, true))
      .orderBy(desc(series.popularity), asc(series.id)),
  ])
  return {
    tags: tags.filter((tag) => tag.media > 0),
    genres: genres.rows.map((row) => row.genre),
    formats: formats.rows.map((row) => row.format),
    series: seriesRows,
  }
}
