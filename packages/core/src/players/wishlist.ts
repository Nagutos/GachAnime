import { characters, userCards, wishlistItems, type Executor } from '@gachanime/db'
import { and, eq, sql } from 'drizzle-orm'
import { AppError } from '../errors'

/**
 * Adds or removes a character from the wishlist. Any visible character qualifies: drawable ones
 * (even locked: "I want this mystery Epic") and those the player already obtained.
 */
export async function setWishlisted(
  db: Executor,
  userId: string,
  characterId: number,
  wishlisted: boolean,
): Promise<{ wishlisted: boolean }> {
  if (!wishlisted) {
    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.characterId, characterId)))
    return { wishlisted: false }
  }
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
  await db.insert(wishlistItems).values({ userId, characterId }).onConflictDoNothing()
  return { wishlisted: true }
}
