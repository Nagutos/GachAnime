import { characters, userCards, wishlistItems, type Database } from '@gachanime/db'
import type { ProgressionUpdate } from '@gachanime/shared'
import { and, eq, sql } from 'drizzle-orm'
import { AppError } from '../errors'
import { emitEvents } from '../progression/engine'

/**
 * Adds or removes a character from the wishlist. Any visible character qualifies: drawable ones
 * (even locked: "I want this mystery Epic") and those the player already obtained.
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
    const [visible] = await db
      .select({ id: characters.id })
      .from(characters)
      .leftJoin(
        userCards,
        and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
      )
      .where(
        and(
          eq(characters.id, characterId),
          sql`(${userCards.userId} IS NOT NULL OR EXISTS (SELECT 1 FROM drawable_characters d
          WHERE d.character_id = "characters"."id"))`,
        ),
      )
    if (!visible) throw new AppError('NOT_FOUND', `Character #${characterId} not found`)
    const added = await db
      .insert(wishlistItems)
      .values({ userId, characterId })
      .onConflictDoNothing()
      .returning({ characterId: wishlistItems.characterId })
    const progression =
      added.length > 0
        ? await emitEvents(db, userId, [{ type: 'wishlist_added', characterId }])
        : { completed: [] }
    return { wishlisted: true, progression }
  })
}
