import { characters, rarities, userCards, type Database, type Executor } from '@gachanime/db'
import type {
  RecycleCardsRequest,
  RecycleDuplicatesRequest,
  RecycleFilter,
  RecyclePreview,
  RecycleResult,
} from '@gachanime/shared'
import { recycleValuePerCopy } from '@gachanime/game'
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { AppError } from '../errors'
import { emitEvents } from '../progression/engine'
import { changeGems, lockPlayer } from './gems'
import { getPlayerRecycleFactor } from './upgrades'

/** Copies beyond the first, minus locked copies (GAME_DESIGN §3), in SQL. */
const recyclable = sql<number>`greatest(${userCards.quantity} - 1 - ${userCards.lockedQuantity}, 0)`

/** Gems per recycled copy of a rarity with the player's factor: `recycleValuePerCopy` in SQL. */
const valuePerCopy = (factor: number) =>
  sql<number>`((${rarities.recycleValue}::bigint * ${factor} + 5000) / 10000)`

/**
 * Recycles `count` duplicates of one character. Never the first copy, never locked copies:
 * the conditional update fails rather than going below.
 */
export async function recycleCards(
  database: Database,
  userId: string,
  input: RecycleCardsRequest,
): Promise<RecycleResult> {
  return database.transaction(async (tx) => {
    await lockPlayer(tx, userId)
    const [card] = await tx
      .select({ recyclable, recycleValue: rarities.recycleValue, rarityKey: rarities.key })
      .from(userCards)
      .innerJoin(characters, eq(characters.id, userCards.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .where(and(eq(userCards.userId, userId), eq(userCards.characterId, input.characterId)))
    const available = card?.recyclable ?? 0
    if (!card || available < input.count) {
      throw new AppError('NOTHING_TO_RECYCLE', 'Not enough duplicates to recycle', { available })
    }

    const updated = await tx
      .update(userCards)
      .set({ quantity: sql`${userCards.quantity} - ${input.count}` })
      .where(
        and(
          eq(userCards.userId, userId),
          eq(userCards.characterId, input.characterId),
          sql`${userCards.quantity} - 1 - ${userCards.lockedQuantity} >= ${input.count}`,
        ),
      )
      .returning({ quantity: userCards.quantity })
    if (updated.length === 0) {
      throw new AppError('NOTHING_TO_RECYCLE', 'Not enough duplicates to recycle', { available })
    }

    const factor = await getPlayerRecycleFactor(tx, userId)
    const gems = input.count * recycleValuePerCopy(card.recycleValue, factor)
    const gemBalance =
      gems > 0
        ? await changeGems(tx, {
            userId,
            amount: gems,
            reason: 'recycle',
            refType: 'character',
            refId: input.characterId,
          })
        : (await lockPlayer(tx, userId)).gemBalance
    const progression = await emitEvents(tx, userId, [
      { type: 'card_recycled', rarity: card.rarityKey, count: input.count },
    ])
    return { cards: input.count, gems, gemBalance, progression }
  })
}

/** Favorites keep their duplicates in a bulk recycle unless asked (GAME_DESIGN §6). */
const notFavorite = (userId: string, characterId: SQL) =>
  sql`NOT EXISTS (SELECT 1 FROM favorite_items f
    WHERE f.user_id = ${userId} AND f.character_id = ${characterId})`

function duplicateConditions(userId: string, filter: RecycleFilter): SQL[] {
  const conditions = [eq(userCards.userId, userId), sql`${recyclable} > 0`]
  if (filter.rarities?.length) conditions.push(inArray(rarities.key, filter.rarities))
  // Outer column named explicitly: Drizzle would render it unqualified (bound to f.character_id).
  if (!filter.includeFavorites) {
    conditions.push(notFavorite(userId, sql`"user_cards"."character_id"`))
  }
  return conditions
}

/** What "recycle all duplicates" would do with this filter. */
export async function previewRecycleDuplicates(
  db: Executor,
  userId: string,
  filter: RecycleFilter,
): Promise<RecyclePreview> {
  const factor = await getPlayerRecycleFactor(db, userId)
  const rows = await db
    .select({
      rarityKey: rarities.key,
      characters: sql<number>`count(*)::int`,
      cards: sql<number>`sum(${recyclable})::int`,
      gems: sql<number>`sum(${recyclable} * ${valuePerCopy(factor)})::int`,
    })
    .from(userCards)
    .innerJoin(characters, eq(characters.id, userCards.characterId))
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
    .where(and(...duplicateConditions(userId, filter)))
    .groupBy(rarities.key, rarities.sortOrder)
    .orderBy(rarities.sortOrder)
  return {
    cards: rows.reduce((sum, row) => sum + row.cards, 0),
    characters: rows.reduce((sum, row) => sum + row.characters, 0),
    gems: rows.reduce((sum, row) => sum + row.gems, 0),
    byRarity: rows.map(({ rarityKey, cards, gems }) => ({ rarityKey, cards, gems })),
  }
}

/**
 * Recycles every duplicate matching the filter, in one transaction. The player confirmed a
 * preview: if the result would differ (a booster opened in another tab…), nothing happens and
 * PREVIEW_OUTDATED returns the fresh preview.
 */
export async function recycleAllDuplicates(
  database: Database,
  userId: string,
  input: RecycleDuplicatesRequest,
): Promise<RecycleResult> {
  return database.transaction(async (tx) => {
    await lockPlayer(tx, userId)
    const preview = await previewRecycleDuplicates(tx, userId, input)
    if (preview.cards === 0) throw new AppError('NOTHING_TO_RECYCLE', 'No duplicate to recycle')
    if (preview.cards !== input.expected.cards || preview.gems !== input.expected.gems) {
      throw new AppError('PREVIEW_OUTDATED', 'The duplicates changed since the preview', preview)
    }

    const rarityFilter = input.rarities?.length
      ? sql`AND r.key IN (${sql.join(
          input.rarities.map((key) => sql`${key}`),
          sql`, `,
        )})`
      : sql``
    const favoriteFilter = input.includeFavorites
      ? sql``
      : sql`AND ${notFavorite(userId, sql`uc.character_id`)}`
    await tx.execute(sql`
      UPDATE user_cards uc
      SET quantity = uc.quantity - (uc.quantity - 1 - uc.locked_quantity)
      FROM characters c JOIN rarities r ON r.id = c.rarity_id
      WHERE c.id = uc.character_id AND uc.user_id = ${userId}
        AND uc.quantity - 1 - uc.locked_quantity > 0 ${rarityFilter} ${favoriteFilter}`)

    const gemBalance =
      preview.gems > 0
        ? await changeGems(tx, { userId, amount: preview.gems, reason: 'recycle', refType: 'bulk' })
        : (await lockPlayer(tx, userId)).gemBalance
    const progression = await emitEvents(
      tx,
      userId,
      preview.byRarity.map((row) => ({
        type: 'card_recycled' as const,
        rarity: row.rarityKey,
        count: row.cards,
      })),
    )
    return { cards: preview.cards, gems: preview.gems, gemBalance, progression }
  })
}
