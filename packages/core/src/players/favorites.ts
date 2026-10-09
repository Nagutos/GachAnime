import {
  characters,
  favoriteItems,
  rarities,
  userCards,
  wishlistItems,
  type Database,
  type Executor,
} from '@gachanime/db'
import type {
  CharacterCard,
  FavoritesListResponse,
  ObtainedCollectionItem,
} from '@gachanime/shared'
import { and, asc, count, eq, inArray, lte, sql } from 'drizzle-orm'
import { AppError } from '../errors'
import { characterCardColumns, toCharacterCard } from './cards'
import { getSetting } from '../settings'
import { collectionItemColumns, toCollectionItem } from './collection'
import { lockPlayer } from './gems'

/**
 * Adds a character at the end of the player's favorites, or removes it. Only characters obtained
 * at least once qualify (a card traded away later stays a favorite). The profile lock keeps
 * concurrent additions within `favorites.maxItems` and their positions distinct.
 */
export async function setFavorite(
  database: Database,
  userId: string,
  characterId: number,
  favorite: boolean,
): Promise<{ favorite: boolean }> {
  return database.transaction(async (db) => {
    await lockPlayer(db, userId)
    if (!favorite) {
      await db
        .delete(favoriteItems)
        .where(and(eq(favoriteItems.userId, userId), eq(favoriteItems.characterId, characterId)))
      return { favorite: false }
    }
    const [obtained] = await db
      .select({ favorite: sql<boolean>`${favoriteItems.userId} IS NOT NULL` })
      .from(userCards)
      .leftJoin(
        favoriteItems,
        and(eq(favoriteItems.characterId, userCards.characterId), eq(favoriteItems.userId, userId)),
      )
      .where(and(eq(userCards.userId, userId), eq(userCards.characterId, characterId)))
    if (!obtained) {
      throw new AppError('NOT_OBTAINED', `Character #${characterId} was never obtained`)
    }
    if (obtained.favorite) return { favorite: true }

    const { maxItems } = await getSetting(db, 'favorites')
    const [size] = await db
      .select({
        value: count(),
        last: sql<number>`coalesce(max(${favoriteItems.position}), 0)::int`,
      })
      .from(favoriteItems)
      .where(eq(favoriteItems.userId, userId))
    if ((size?.value ?? 0) >= maxItems) {
      throw new AppError('FAVORITES_FULL', `At most ${maxItems} favorites`, { max: maxItems })
    }
    await db.insert(favoriteItems).values({ userId, characterId, position: (size?.last ?? 0) + 1 })
    return { favorite: true }
  })
}

/** The player's favorites in their own order. */
export async function listFavorites(db: Executor, userId: string): Promise<FavoritesListResponse> {
  const [rows, { maxItems }] = await Promise.all([
    db
      .select(collectionItemColumns)
      .from(favoriteItems)
      .innerJoin(characters, eq(characters.id, favoriteItems.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .innerJoin(
        userCards,
        and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
      )
      .leftJoin(
        wishlistItems,
        and(eq(wishlistItems.characterId, characters.id), eq(wishlistItems.userId, userId)),
      )
      .where(eq(favoriteItems.userId, userId))
      .orderBy(asc(favoriteItems.position), asc(characters.id)),
    getSetting(db, 'favorites'),
  ])
  return {
    items: rows
      .map(toCollectionItem)
      .filter((item): item is ObtainedCollectionItem => !item.locked),
    maxItems,
  }
}

/** Sets the order of the favorites: `ids` must list every favorite exactly once. */
export async function reorderFavorites(
  database: Database,
  userId: string,
  ids: readonly number[],
): Promise<void> {
  await database.transaction(async (db) => {
    await lockPlayer(db, userId)
    const current = await db
      .select({ characterId: favoriteItems.characterId })
      .from(favoriteItems)
      .where(eq(favoriteItems.userId, userId))
    const known = new Set(current.map((row) => row.characterId))
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => known.has(id))
    ) {
      throw new AppError('VALIDATION_FAILED', 'The new order must list every favorite exactly once')
    }
    if (ids.length === 0) return
    await db.execute(sql`
      UPDATE favorite_items SET position = ordered.position
      FROM unnest(${`{${ids.join(',')}}`}::bigint[]) WITH ORDINALITY AS ordered(id, position)
      WHERE favorite_items.user_id = ${userId} AND favorite_items.character_id = ordered.id`)
  })
}

/** The first `limit` favorites of each player, by user id (main favorite first). */
export async function loadFavoriteCards(
  db: Executor,
  userIds: readonly string[],
  limit = 1,
): Promise<Map<string, CharacterCard[]>> {
  const byUser = new Map<string, CharacterCard[]>()
  if (userIds.length === 0) return byUser
  const ranked = db
    .select({
      userId: favoriteItems.userId,
      characterId: favoriteItems.characterId,
      rank: sql<number>`row_number() OVER (PARTITION BY ${favoriteItems.userId}
        ORDER BY ${favoriteItems.position}, ${favoriteItems.characterId})`.as('rank'),
    })
    .from(favoriteItems)
    .where(inArray(favoriteItems.userId, [...userIds]))
    .as('ranked')
  const rows = await db
    .select({ userId: ranked.userId, ...characterCardColumns })
    .from(ranked)
    .innerJoin(characters, eq(characters.id, ranked.characterId))
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
    .where(lte(ranked.rank, limit))
    .orderBy(ranked.userId, ranked.rank)
  for (const row of rows) {
    byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), toCharacterCard(row)])
  }
  return byUser
}
