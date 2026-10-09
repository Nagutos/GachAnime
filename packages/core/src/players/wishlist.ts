import {
  characters,
  favoriteItems,
  rarities,
  userCards,
  wishlistItems,
  type Database,
  type Executor,
} from '@gachanime/db'
import type { ProgressionUpdate, WishlistListResponse } from '@gachanime/shared'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import type { DrawablePool } from '../catalog/drawable-pool'
import { AppError } from '../errors'
import { emitEvents } from '../progression/engine'
import { getSetting } from '../settings'
import { collectionItemColumns, toCollectionItem } from './collection'
import { lockPlayer } from './gems'

/**
 * Adds or removes a character from the wishlist. Any visible character qualifies: drawable ones
 * (even locked: "I want this mystery Epic") and those the player already obtained. The wishlist
 * holds at most `wishlist.maxItems` characters (the profile lock keeps concurrent adds in bounds).
 */
export async function setWishlisted(
  database: Database,
  userId: string,
  characterId: number,
  wishlisted: boolean,
): Promise<{ wishlisted: boolean; progression: ProgressionUpdate }> {
  if (!wishlisted) {
    await database
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.characterId, characterId)))
    return { wishlisted: false, progression: { completed: [] } }
  }
  return database.transaction(async (db) => {
    await lockPlayer(db, userId)
    const [visible] = await db
      .select({ id: characters.id, wishlisted: sql<boolean>`${wishlistItems.userId} IS NOT NULL` })
      .from(characters)
      .leftJoin(
        userCards,
        and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
      )
      .leftJoin(
        wishlistItems,
        and(eq(wishlistItems.characterId, characters.id), eq(wishlistItems.userId, userId)),
      )
      .where(
        and(
          eq(characters.id, characterId),
          sql`(${userCards.userId} IS NOT NULL OR EXISTS (SELECT 1 FROM drawable_characters d
          WHERE d.character_id = "characters"."id"))`,
        ),
      )
    if (!visible) throw new AppError('NOT_FOUND', `Character #${characterId} not found`)
    if (visible.wishlisted) return { wishlisted: true, progression: { completed: [] } }

    const { maxItems } = await getSetting(db, 'wishlist')
    const [size] = await db
      .select({ value: count() })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId))
    if ((size?.value ?? 0) >= maxItems) {
      throw new AppError('WISHLIST_FULL', `The wishlist holds at most ${maxItems} characters`, {
        max: maxItems,
      })
    }
    await db.insert(wishlistItems).values({ userId, characterId })
    const progression = await emitEvents(db, userId, [{ type: 'wishlist_added', characterId }])
    return { wishlisted: true, progression }
  })
}

/** The player's wishlist, most recently added first. */
export async function listWishlist(db: Executor, userId: string): Promise<WishlistListResponse> {
  const [rows, rules] = await Promise.all([
    db
      .select(collectionItemColumns)
      .from(wishlistItems)
      .innerJoin(characters, eq(characters.id, wishlistItems.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .leftJoin(
        userCards,
        and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
      )
      .leftJoin(
        favoriteItems,
        and(eq(favoriteItems.characterId, characters.id), eq(favoriteItems.userId, userId)),
      )
      .where(eq(wishlistItems.userId, userId))
      .orderBy(desc(wishlistItems.createdAt), desc(characters.id)),
    getSetting(db, 'wishlist'),
  ])
  return { items: rows.map(toCollectionItem), ...rules }
}

/**
 * Wished characters the player does not own now, by rarity id, restricted to a booster pool:
 * the candidates of the wishlist boost (GAME_DESIGN §6).
 */
export async function loadWishedInPool(
  db: Executor,
  userId: string,
  pool: DrawablePool,
): Promise<Map<number, number[]>> {
  const rows = await db
    .select({ characterId: characters.id, rarityId: characters.rarityId })
    .from(wishlistItems)
    .innerJoin(characters, eq(characters.id, wishlistItems.characterId))
    .leftJoin(
      userCards,
      and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
    )
    .where(and(eq(wishlistItems.userId, userId), sql`coalesce(${userCards.quantity}, 0) = 0`))
    .orderBy(characters.id)
  const wished = new Map<number, number[]>()
  for (const row of rows) {
    if (!pool.get(row.rarityId)?.includes(row.characterId)) continue
    wished.set(row.rarityId, [...(wished.get(row.rarityId) ?? []), row.characterId])
  }
  return wished
}
