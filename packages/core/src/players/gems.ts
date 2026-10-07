import { gemTransactions, playerProfiles, type Database, type Executor } from '@gachanime/db'
import type { GemHistoryResponse, GemTransactionReason } from '@gachanime/shared'
import { count, desc, eq, sql } from 'drizzle-orm'
import { recordAdminAction, type AdminActionInput } from '../admin/audit'
import { AppError } from '../errors'

export interface PlayerLock {
  gemBalance: number
  freeBoosterAnchorAt: Date
}

/**
 * Locks the player profile row: every inventory or gem operation of a player starts with it
 * (CLAUDE.md, ADR-009). Several players: lock them ordered by id.
 */
export async function lockPlayer(tx: Executor, userId: string): Promise<PlayerLock> {
  const [row] = await tx
    .select({
      gemBalance: playerProfiles.gemBalance,
      freeBoosterAnchorAt: playerProfiles.freeBoosterAnchorAt,
    })
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
    .for('update')
  if (!row) throw new AppError('NOT_FOUND', 'Player profile not found')
  return row
}

export interface GemChange {
  userId: string
  /** Signed: negative for spending. */
  amount: number
  reason: GemTransactionReason
  refType?: string
  refId?: string | number
}

/**
 * Changes a balance and writes its ledger row, in the caller's transaction (the profile must be
 * locked). Spending more than the balance fails with NOT_ENOUGH_GEMS. Returns the new balance.
 */
export async function changeGems(tx: Executor, change: GemChange): Promise<number> {
  if (!Number.isInteger(change.amount) || change.amount === 0) {
    throw new Error('A gem change must be a non-zero integer')
  }
  const [row] = await tx
    .update(playerProfiles)
    .set({ gemBalance: sql`${playerProfiles.gemBalance} + ${change.amount}` })
    .where(
      sql`${playerProfiles.userId} = ${change.userId} AND ${playerProfiles.gemBalance} + ${change.amount} >= 0`,
    )
    .returning({ gemBalance: playerProfiles.gemBalance })
  if (!row) {
    throw new AppError('NOT_ENOUGH_GEMS', 'Not enough gems', { required: -change.amount })
  }
  await tx.insert(gemTransactions).values({
    userId: change.userId,
    amount: change.amount,
    balanceAfter: row.gemBalance,
    reason: change.reason,
    refType: change.refType ?? null,
    refId: change.refId === undefined ? null : String(change.refId),
  })
  return row.gemBalance
}

export async function listGemHistory(
  db: Executor,
  userId: string,
  query: { page: number; pageSize: number },
): Promise<GemHistoryResponse> {
  const [rows, [total], [profile]] = await Promise.all([
    db
      .select({
        id: gemTransactions.id,
        amount: gemTransactions.amount,
        balanceAfter: gemTransactions.balanceAfter,
        reason: gemTransactions.reason,
        createdAt: gemTransactions.createdAt,
      })
      .from(gemTransactions)
      .where(eq(gemTransactions.userId, userId))
      .orderBy(desc(gemTransactions.createdAt), desc(gemTransactions.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(gemTransactions).where(eq(gemTransactions.userId, userId)),
    db
      .select({ gemBalance: playerProfiles.gemBalance })
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, userId)),
  ])
  if (!profile) throw new AppError('NOT_FOUND', 'Player profile not found')
  return {
    items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    gemBalance: profile.gemBalance,
  }
}

/** Admin gem adjustment (positive or negative), audited and written to the ledger. */
export async function adjustGems(
  database: Database,
  input: { userId: string; amount: number; note: string },
  /** `actorId` null: command line. */
  actor: Pick<AdminActionInput, 'actorId' | 'ip'>,
): Promise<number> {
  return database.transaction(async (tx) => {
    const before = await lockPlayer(tx, input.userId)
    const balance = await changeGems(tx, {
      userId: input.userId,
      amount: input.amount,
      reason: 'admin_adjustment',
      refType: 'admin',
      refId: actor.actorId ?? 'cli',
    })
    await recordAdminAction(tx, {
      ...actor,
      action: 'gems.adjust',
      targetType: 'player',
      targetId: input.userId,
      before: { gemBalance: before.gemBalance },
      after: { gemBalance: balance, amount: input.amount, note: input.note },
    })
    return balance
  })
}
