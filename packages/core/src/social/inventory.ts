import { characters, playerProfiles, rarities, userCards, type Executor } from '@gachanime/db'
import type { GameEvent } from '@gachanime/game'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { AppError } from '../errors'

/**
 * Locks several player profiles in id order, so two operations on the same players never
 * deadlock (ADR-009). Returns their gem balances.
 */
export async function lockPlayers(tx: Executor, userIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(userIds)].sort()
  const rows = await tx
    .select({ userId: playerProfiles.userId, gemBalance: playerProfiles.gemBalance })
    .from(playerProfiles)
    .where(inArray(playerProfiles.userId, ids))
    .orderBy(asc(playerProfiles.userId))
    .for('update')
  if (rows.length !== ids.length) throw new AppError('NOT_FOUND', 'Player profile not found')
  return new Map(rows.map((row) => [row.userId, row.gemBalance]))
}

/** Locks `quantity` free copies (listing, pending trade); fails if fewer are free. */
export async function lockCopies(
  tx: Executor,
  userId: string,
  characterId: number,
  quantity: number,
): Promise<void> {
  const updated = await tx
    .update(userCards)
    .set({ lockedQuantity: sql`${userCards.lockedQuantity} + ${quantity}` })
    .where(
      and(
        eq(userCards.userId, userId),
        eq(userCards.characterId, characterId),
        sql`${userCards.quantity} - ${userCards.lockedQuantity} >= ${quantity}`,
      ),
    )
    .returning({ characterId: userCards.characterId })
  if (updated.length === 0) {
    throw new AppError('CARD_UNAVAILABLE', 'Not enough free copies of this card', { characterId })
  }
}

export async function unlockCopies(
  tx: Executor,
  userId: string,
  characterId: number,
  quantity: number,
): Promise<void> {
  await tx
    .update(userCards)
    .set({ lockedQuantity: sql`greatest(${userCards.lockedQuantity} - ${quantity}, 0)` })
    .where(and(eq(userCards.userId, userId), eq(userCards.characterId, characterId)))
}

export interface CopyMove {
  from: string
  to: string
  characterId: number
  quantity: number
  /** The copies were locked (listing, proposer side of a trade). */
  fromLocked: boolean
}

/**
 * Moves copies between players (conditional decrement, never below the locked copies). The
 * receiver's row is created when needed: that unlocks the wiki entry. Returns whether the
 * receiver never had this character before.
 */
export async function moveCopies(tx: Executor, move: CopyMove, now: Date): Promise<boolean> {
  const available = move.fromLocked
    ? sql`${userCards.lockedQuantity} >= ${move.quantity}`
    : sql`${userCards.quantity} - ${userCards.lockedQuantity} >= ${move.quantity}`
  const updated = await tx
    .update(userCards)
    .set({
      quantity: sql`${userCards.quantity} - ${move.quantity}`,
      ...(move.fromLocked
        ? { lockedQuantity: sql`${userCards.lockedQuantity} - ${move.quantity}` }
        : {}),
    })
    .where(
      and(eq(userCards.userId, move.from), eq(userCards.characterId, move.characterId), available),
    )
    .returning({ characterId: userCards.characterId })
  if (updated.length === 0) {
    throw new AppError('CARD_UNAVAILABLE', 'The card is no longer available', {
      characterId: move.characterId,
    })
  }
  const [existing] = await tx
    .select({ characterId: userCards.characterId })
    .from(userCards)
    .where(and(eq(userCards.userId, move.to), eq(userCards.characterId, move.characterId)))
  await tx
    .insert(userCards)
    .values({
      userId: move.to,
      characterId: move.characterId,
      quantity: move.quantity,
      firstObtainedAt: now,
      lastObtainedAt: now,
    })
    .onConflictDoUpdate({
      target: [userCards.userId, userCards.characterId],
      set: {
        quantity: sql`${userCards.quantity} + excluded.quantity`,
        lastObtainedAt: sql`excluded.last_obtained_at`,
      },
    })
  return !existing
}

/** `card_obtained` events (one per rarity) for cards received by trade or purchase. */
export async function obtainedEvents(
  tx: Executor,
  received: { characterId: number; quantity: number; isNew: boolean }[],
): Promise<GameEvent[]> {
  if (received.length === 0) return []
  const rows = await tx
    .select({ id: characters.id, rarityKey: rarities.key })
    .from(characters)
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
    .where(
      inArray(
        characters.id,
        received.map((item) => item.characterId),
      ),
    )
  const rarityOf = new Map(rows.map((row) => [row.id, row.rarityKey]))
  const byRarity = new Map<string, { count: number; newCount: number }>()
  for (const item of received) {
    const key = rarityOf.get(item.characterId) ?? 'common'
    const entry = byRarity.get(key) ?? { count: 0, newCount: 0 }
    entry.count += item.quantity
    if (item.isNew) entry.newCount++
    byRarity.set(key, entry)
  }
  return [...byRarity].map(([rarity, entry]) => ({ type: 'card_obtained', rarity, ...entry }))
}
