import { catalogState, drawableCharacters, themeCharacters, type Executor } from '@gachanime/db'
import { and, eq, sql } from 'drizzle-orm'

/** Drawable character ids per rarity id, each list sorted (the draw picks an index). */
export type DrawablePool = ReadonlyMap<number, readonly number[]>

interface CacheEntry<T> {
  version: string
  value: T
}

/**
 * Booster pools are cached per process and per catalog version (ADR-024): database triggers
 * give `catalog_state.version` a new value whenever drawability or a pack pool may change, so
 * a stale pool is never used once the change is committed. Entries of older versions are
 * dropped on the next load.
 */
const pools = new Map<string, CacheEntry<DrawablePool>>()
let drawableIds: CacheEntry<ReadonlySet<number>> | null = null
let themeSizes: CacheEntry<ReadonlyMap<number, number>> | null = null

export async function getCatalogVersion(db: Executor): Promise<string> {
  const [row] = await db.select({ version: catalogState.version }).from(catalogState)
  // No row only in a database that was never seeded: never cache in that case.
  return row?.version ?? ''
}

async function queryPool(db: Executor, themeId: number | null): Promise<DrawablePool> {
  const base = db
    .select({
      rarityId: drawableCharacters.rarityId,
      ids: sql<
        string[]
      >`array_agg(${drawableCharacters.characterId} ORDER BY ${drawableCharacters.characterId})`,
    })
    .from(drawableCharacters)
  const rows = await (
    themeId === null
      ? base
      : base.innerJoin(
          themeCharacters,
          and(
            eq(themeCharacters.characterId, drawableCharacters.characterId),
            eq(themeCharacters.themeId, themeId),
          ),
        )
  ).groupBy(drawableCharacters.rarityId)
  // array_agg of bigint comes back as strings.
  return new Map(rows.map((row) => [row.rarityId, row.ids.map(Number)]))
}

/** The whole catalog's pool, or a pack's materialized pool (`theme_characters`). */
export async function loadDrawablePool(
  db: Executor,
  themeId: number | null,
): Promise<DrawablePool> {
  const version = await getCatalogVersion(db)
  const key = themeId === null ? 'all' : `theme:${themeId}`
  const cached = pools.get(key)
  if (version && cached?.version === version) return cached.value

  const value = await queryPool(db, themeId)
  if (version) {
    for (const [otherKey, entry] of pools) if (entry.version !== version) pools.delete(otherKey)
    pools.set(key, { version, value })
  }
  return value
}

/** Every drawable character id (catalog completion). */
export async function loadDrawableIds(db: Executor): Promise<ReadonlySet<number>> {
  const version = await getCatalogVersion(db)
  if (version && drawableIds?.version === version) return drawableIds.value
  const pool = await loadDrawablePool(db, null)
  const value = new Set([...pool.values()].flat())
  if (version) drawableIds = { version, value }
  return value
}

/** Number of drawable characters in each pack pool, by theme id (packs list). */
export async function loadThemePoolSizes(db: Executor): Promise<ReadonlyMap<number, number>> {
  const version = await getCatalogVersion(db)
  if (version && themeSizes?.version === version) return themeSizes.value
  const rows = await db
    .select({ themeId: themeCharacters.themeId, size: sql<number>`count(*)::int` })
    .from(themeCharacters)
    .innerJoin(drawableCharacters, eq(drawableCharacters.characterId, themeCharacters.characterId))
    .groupBy(themeCharacters.themeId)
  const value = new Map(rows.map((row) => [row.themeId, row.size]))
  if (version) themeSizes = { version, value }
  return value
}
