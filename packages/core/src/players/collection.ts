import { characters, drawableCharacters, rarities, userCards, type Executor } from '@gachanime/db'
import type { CollectionQuery, CollectionResponse } from '@gachanime/shared'
import { and, asc, count, desc, eq, gt, ilike, or, sql, type SQL } from 'drizzle-orm'
import { containsPattern } from '../catalog/admin-series'
import { characterCardColumns, toCharacterCard } from './cards'

/** Characters currently owned by the player (quantity ≥ 1), filtered, sorted and paginated. */
export async function listCollection(
  db: Executor,
  userId: string,
  query: CollectionQuery,
): Promise<CollectionResponse> {
  const conditions: SQL[] = [eq(userCards.userId, userId), gt(userCards.quantity, 0)]
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(or(ilike(characters.nameFull, pattern), ilike(characters.nameNative, pattern))!)
  }
  if (query.rarity) conditions.push(eq(rarities.key, query.rarity))
  if (query.seriesId) {
    conditions.push(sql`EXISTS (SELECT 1 FROM series_characters sc
      WHERE sc.character_id = "characters"."id" AND sc.series_id = ${query.seriesId})`)
  }
  if (query.duplicates) conditions.push(gt(userCards.quantity, 1))
  const where = and(...conditions)

  const order = {
    // Cards of one opening share a timestamp: show the rarest first.
    recent: [
      desc(userCards.lastObtainedAt),
      desc(rarities.sortOrder),
      asc(characters.nameFull),
      asc(characters.id),
    ],
    rarity: [desc(rarities.sortOrder), asc(characters.nameFull), asc(characters.id)],
    name: [asc(characters.nameFull), asc(characters.id)],
    count: [desc(userCards.quantity), desc(rarities.sortOrder), asc(characters.id)],
  }[query.sort]

  const base = () =>
    db
      .select({
        ...characterCardColumns,
        quantity: userCards.quantity,
        firstObtainedAt: userCards.firstObtainedAt,
        lastObtainedAt: userCards.lastObtainedAt,
      })
      .from(userCards)
      .innerJoin(characters, eq(characters.id, userCards.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))

  const [rows, [filtered], [summary], [catalog]] = await Promise.all([
    base()
      .where(where)
      .orderBy(...order)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(userCards)
      .innerJoin(characters, eq(characters.id, userCards.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .where(where),
    db
      .select({
        owned: count(),
        cards: sql<number>`coalesce(sum(${userCards.quantity}), 0)::int`,
      })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), gt(userCards.quantity, 0))),
    db.select({ value: count() }).from(drawableCharacters),
  ])

  return {
    items: rows.map((row) => ({
      ...toCharacterCard(row),
      quantity: row.quantity,
      firstObtainedAt: row.firstObtainedAt.toISOString(),
      lastObtainedAt: row.lastObtainedAt.toISOString(),
    })),
    total: filtered?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      owned: summary?.owned ?? 0,
      cards: summary?.cards ?? 0,
      catalog: catalog?.value ?? 0,
    },
  }
}
