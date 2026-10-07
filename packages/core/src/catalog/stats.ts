import { characters, rarities, series, type Executor } from '@gachanime/db'
import { localizedTextSchema, type AdminRarityStats } from '@gachanime/shared'
import { asc, count, eq, sql } from 'drizzle-orm'

/** Rarity distribution of the catalog, used to tune the favourites thresholds. */
export async function getCatalogStats(db: Executor): Promise<AdminRarityStats> {
  const [rows, [totals], [seriesTotals]] = await Promise.all([
    db
      .select({
        id: rarities.id,
        key: rarities.key,
        sortOrder: rarities.sortOrder,
        name: rarities.name,
        colorToken: rarities.colorToken,
        favouritesThreshold: rarities.favouritesThreshold,
        characterCount: sql<number>`count(${characters.id}) FILTER (WHERE ${characters.isActive})::int`,
        overriddenCount: sql<number>`count(${characters.id}) FILTER (WHERE ${characters.rarityOverridden})::int`,
      })
      .from(rarities)
      .leftJoin(characters, eq(characters.rarityId, rarities.id))
      .groupBy(rarities.id)
      .orderBy(asc(rarities.sortOrder)),
    db
      .select({
        characters: count(),
        unclassifiedGender: sql<number>`count(*) FILTER (WHERE coalesce(${characters.genderOverride}, ${characters.genderClass}) = 'unclassified')::int`,
        drawable: sql<number>`(SELECT count(*)::int FROM drawable_characters)`,
      })
      .from(characters),
    db
      .select({
        series: count(),
        activeSeries: sql<number>`count(*) FILTER (WHERE ${series.isActive})::int`,
      })
      .from(series),
  ])
  return {
    rarities: rows.map((row) => ({ ...row, name: localizedTextSchema.parse(row.name) })),
    totals: {
      characters: totals?.characters ?? 0,
      drawable: totals?.drawable ?? 0,
      unclassifiedGender: totals?.unclassifiedGender ?? 0,
      series: seriesTotals?.series ?? 0,
      activeSeries: seriesTotals?.activeSeries ?? 0,
    },
  }
}
