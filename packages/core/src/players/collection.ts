import { characters, rarities, userCards, wishlistItems, type Executor } from '@gachanime/db'
import { recyclableCopies } from '@gachanime/game'
import type {
  CollectionItem,
  CollectionQuery,
  CollectionResponse,
  CollectionSortKey,
} from '@gachanime/shared'
import { and, count, eq, gt, ilike, or, sql, type SQL } from 'drizzle-orm'
import { containsPattern } from '../catalog/admin-series'
import { characterCardColumns, toCharacterCard } from './cards'
import { loadDrawableIds } from '../catalog/drawable-pool'

const isDrawable = sql`EXISTS (SELECT 1 FROM drawable_characters d
  WHERE d.character_id = "characters"."id")`
const ownedQuantity = sql`coalesce(${userCards.quantity}, 0)`
const isUnlocked = sql`${userCards.userId} IS NOT NULL`

const SORT_COLUMNS: Record<CollectionSortKey, SQL> = {
  recent: sql`${userCards.lastObtainedAt}`,
  rarity: sql`${rarities.sortOrder}`,
  // Locked entries never reveal their name: they sort after unlocked ones.
  name: sql`CASE WHEN ${isUnlocked} THEN ${characters.nameFull} END`,
  count: ownedQuantity,
  series: sql`(SELECT s.title FROM series_characters sc JOIN series s ON s.id = sc.series_id
    WHERE sc.character_id = "characters"."id" AND s.is_active
    ORDER BY s.popularity DESC, s.id LIMIT 1)`,
}

/**
 * The player's collection: characters owned now (default), missing ones (never obtained, or no
 * copy left), or both. Missing never-obtained characters are masked like locked wiki entries,
 * and the name search only matches unlocked entries (it would otherwise reveal locked names).
 */
export async function listCollection(
  db: Executor,
  userId: string,
  query: CollectionQuery,
): Promise<CollectionResponse> {
  const conditions: SQL[] = []
  // Strict on user_cards: Postgres turns the left join into an inner join driven by the
  // player's cards instead of scanning the whole catalog.
  if (query.ownership === 'owned') conditions.push(gt(userCards.quantity, 0))
  else {
    // The catalog (drawable characters) plus everything the player ever obtained.
    conditions.push(sql`(${isDrawable} OR ${isUnlocked})`)
    if (query.ownership === 'missing') conditions.push(sql`${ownedQuantity} = 0`)
  }
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(
      and(
        isUnlocked,
        or(ilike(characters.nameFull, pattern), ilike(characters.nameNative, pattern)),
      )!,
    )
  }
  if (query.rarity) conditions.push(eq(rarities.key, query.rarity))
  if (query.seriesId) {
    conditions.push(sql`EXISTS (SELECT 1 FROM series_characters sc
      WHERE sc.character_id = "characters"."id" AND sc.series_id = ${query.seriesId})`)
  }
  if (query.theme) {
    conditions.push(sql`EXISTS (SELECT 1 FROM theme_characters tc JOIN themes t ON t.id = tc.theme_id
      WHERE tc.character_id = "characters"."id" AND t.key = ${query.theme})`)
  }
  if (query.duplicates) conditions.push(gt(userCards.quantity, 1))
  if (query.wishlist) conditions.push(sql`${wishlistItems.userId} IS NOT NULL`)
  const where = and(...conditions)

  const order = [
    ...query.sort.map(
      (sort) => sql`${SORT_COLUMNS[sort.key]} ${sql.raw(sort.direction.toUpperCase())} NULLS LAST`,
    ),
    sql`${characters.id} ASC`,
  ]
  const playerCard = and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId))
  const playerWish = and(
    eq(wishlistItems.characterId, characters.id),
    eq(wishlistItems.userId, userId),
  )

  const [rows, [filtered], [summary], [catalog]] = await Promise.all([
    db
      .select({
        ...characterCardColumns,
        ownerId: userCards.userId,
        quantity: userCards.quantity,
        lockedQuantity: userCards.lockedQuantity,
        firstObtainedAt: userCards.firstObtainedAt,
        lastObtainedAt: userCards.lastObtainedAt,
        wishlisted: sql<boolean>`${wishlistItems.userId} IS NOT NULL`,
      })
      .from(characters)
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .leftJoin(userCards, playerCard)
      .leftJoin(wishlistItems, playerWish)
      .where(where)
      .orderBy(...order)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(characters)
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .leftJoin(userCards, playerCard)
      .leftJoin(wishlistItems, playerWish)
      .where(where),
    db
      .select({
        owned: count(),
        cards: sql<number>`coalesce(sum(${userCards.quantity}), 0)::int`,
      })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), gt(userCards.quantity, 0))),
    loadDrawableIds(db).then((ids) => [{ value: ids.size }]),
  ])

  return {
    items: rows.map((row): CollectionItem => {
      if (!row.ownerId || !row.firstObtainedAt || !row.lastObtainedAt) {
        return { locked: true, id: row.id, rarityKey: row.rarityKey, wishlisted: row.wishlisted }
      }
      const quantity = row.quantity ?? 0
      const lockedQuantity = row.lockedQuantity ?? 0
      return {
        ...toCharacterCard(row),
        locked: false,
        quantity,
        lockedQuantity,
        recyclable: recyclableCopies(quantity, lockedQuantity),
        wishlisted: row.wishlisted,
        firstObtainedAt: row.firstObtainedAt.toISOString(),
        lastObtainedAt: row.lastObtainedAt.toISOString(),
      }
    }),
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
