import {
  characters,
  playerProfiles,
  rarities,
  tradeItems,
  trades,
  userCards,
  users,
  wishlistItems,
  type Database,
  type Executor,
} from '@gachanime/db'
import type {
  CounterTradeRequest,
  Paginated,
  ProgressionUpdate,
  ProposeTradeRequest,
  TradeDto,
  TradeItem,
} from '@gachanime/shared'
import { and, count, desc, eq, gt, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { AppError } from '../errors'
import { characterCardColumns, toCharacterCard } from '../players/cards'
import { loadFavoriteCards } from '../players/favorites'
import { emitEvents } from '../progression/engine'
import { getSetting } from '../settings'
import { lockCopies, lockPlayers, moveCopies, obtainedEvents, unlockCopies } from './inventory'
import { findPlayer } from './players'

type TradeRow = typeof trades.$inferSelect
type ItemInput = { characterId: number; quantity: number }

const isPendingNow = (now: Date) =>
  and(eq(trades.status, 'pending'), or(isNull(trades.expiresAt), gt(trades.expiresAt, now))!)!

async function loadItems(db: Executor, tradeIds: number[]) {
  if (tradeIds.length === 0) return []
  return db
    .select({
      tradeId: tradeItems.tradeId,
      side: tradeItems.side,
      quantity: tradeItems.quantity,
      ...characterCardColumns,
    })
    .from(tradeItems)
    .innerJoin(characters, eq(characters.id, tradeItems.characterId))
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
    .where(inArray(tradeItems.tradeId, tradeIds))
}

/** Trades as seen by `viewerId` (give / receive sides, wishlist highlights). */
async function toTradeDtos(db: Executor, viewerId: string, rows: TradeRow[]): Promise<TradeDto[]> {
  if (rows.length === 0) return []
  const items = await loadItems(
    db,
    rows.map((row) => row.id),
  )
  const people = [...new Set(rows.flatMap((row) => [row.proposerId, row.recipientId]))]
  const [players, wishes, featured] = await Promise.all([
    db
      .select({
        userId: playerProfiles.userId,
        username: playerProfiles.username,
        displayName: users.name,
        avatarUrl: users.image,
      })
      .from(playerProfiles)
      .innerJoin(users, eq(users.id, playerProfiles.userId))
      .where(inArray(playerProfiles.userId, people)),
    db
      .select({ userId: wishlistItems.userId, characterId: wishlistItems.characterId })
      .from(wishlistItems)
      .where(
        and(
          inArray(wishlistItems.userId, people),
          inArray(wishlistItems.characterId, items.length ? items.map((item) => item.id) : [0]),
        ),
      ),
    loadFavoriteCards(db, people),
  ])
  const playerOf = new Map(players.map((player) => [player.userId, player]))
  const wished = new Set(wishes.map((wish) => `${wish.userId}:${wish.characterId}`))

  return rows.map((row) => {
    const outgoing = row.proposerId === viewerId
    const counterpartId = outgoing ? row.recipientId : row.proposerId
    const counterpart = playerOf.get(counterpartId)!
    const side = (key: 'proposer' | 'recipient', receiverId: string): TradeItem[] =>
      items
        .filter((item) => item.tradeId === row.id && item.side === key)
        .map((item) => ({
          quantity: item.quantity,
          character: toCharacterCard(item),
          wishedByReceiver: wished.has(`${receiverId}:${item.id}`),
        }))
    // Proposer items go to the recipient and vice versa.
    const proposerGives = side('proposer', row.recipientId)
    const recipientGives = side('recipient', row.proposerId)
    return {
      id: row.id,
      status: row.status,
      outgoing,
      counterpart: {
        username: counterpart.username,
        displayName: counterpart.displayName,
        avatarUrl: counterpart.avatarUrl,
        featured: featured.get(counterpartId)?.[0] ?? null,
      },
      give: outgoing ? proposerGives : recipientGives,
      receive: outgoing ? recipientGives : proposerGives,
      message: row.message,
      parentTradeId: row.parentTradeId,
      createdAt: row.createdAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    }
  })
}

async function loadTrade(db: Executor, viewerId: string, id: number): Promise<TradeDto> {
  const [row] = await db.select().from(trades).where(eq(trades.id, id))
  if (!row || (row.proposerId !== viewerId && row.recipientId !== viewerId)) {
    throw new AppError('NOT_FOUND', `Trade #${id} not found`)
  }
  return (await toTradeDtos(db, viewerId, [row]))[0]!
}

/** Checks that a player has these copies free right now (not locked). */
async function hasFreeCopies(db: Executor, userId: string, items: ItemInput[]): Promise<boolean> {
  const rows = await db
    .select({
      characterId: userCards.characterId,
      free: sql<number>`${userCards.quantity} - ${userCards.lockedQuantity}`,
    })
    .from(userCards)
    .where(
      and(
        eq(userCards.userId, userId),
        inArray(
          userCards.characterId,
          items.map((item) => item.characterId),
        ),
      ),
    )
  const free = new Map(rows.map((row) => [row.characterId, Number(row.free)]))
  return items.every((item) => (free.get(item.characterId) ?? 0) >= item.quantity)
}

/** Creates a pending trade and locks the proposer's offered copies (caller holds both locks). */
async function insertTrade(
  tx: Executor,
  input: {
    proposerId: string
    recipientId: string
    offer: ItemInput[]
    request: ItemInput[]
    message?: string
    parentTradeId?: number
  },
  now: Date,
): Promise<number> {
  for (const item of input.offer) {
    await lockCopies(tx, input.proposerId, item.characterId, item.quantity)
  }
  if (!(await hasFreeCopies(tx, input.recipientId, input.request))) {
    throw new AppError('CARD_UNAVAILABLE', 'The other player does not have these cards available')
  }
  const { offerTtlDays } = await getSetting(tx, 'trades.offers')
  const [created] = await tx
    .insert(trades)
    .values({
      proposerId: input.proposerId,
      recipientId: input.recipientId,
      parentTradeId: input.parentTradeId ?? null,
      message: input.message || null,
      createdAt: now,
      expiresAt: offerTtlDays > 0 ? new Date(now.getTime() + offerTtlDays * 86_400_000) : null,
    })
    .returning({ id: trades.id })
  await tx.insert(tradeItems).values([
    ...input.offer.map((item) => ({ tradeId: created!.id, side: 'proposer' as const, ...item })),
    ...input.request.map((item) => ({
      tradeId: created!.id,
      side: 'recipient' as const,
      ...item,
    })),
  ])
  return created!.id
}

/** Releases the proposer's locked copies of a trade that ends without moving cards. */
async function releaseOffer(tx: Executor, trade: TradeRow): Promise<void> {
  const offered = await tx
    .select({ characterId: tradeItems.characterId, quantity: tradeItems.quantity })
    .from(tradeItems)
    .where(and(eq(tradeItems.tradeId, trade.id), eq(tradeItems.side, 'proposer')))
  for (const item of offered) {
    await unlockCopies(tx, trade.proposerId, item.characterId, item.quantity)
  }
}

export async function proposeTrade(
  database: Database,
  proposerId: string,
  input: ProposeTradeRequest,
  now = new Date(),
): Promise<TradeDto> {
  const recipient = await findPlayer(database, input.recipient)
  if (recipient.userId === proposerId) {
    throw new AppError('INVALID_TRADE', 'You cannot trade with yourself')
  }
  if (recipient.banned) throw new AppError('PLAYER_BANNED', 'This player is banned')
  return database.transaction(async (tx) => {
    await lockPlayers(tx, [proposerId, recipient.userId])
    const id = await insertTrade(tx, { proposerId, recipientId: recipient.userId, ...input }, now)
    return loadTrade(tx, proposerId, id)
  })
}

/**
 * Counters a received offer: the original becomes `countered` (its locks are released) and a
 * new offer goes the other way, linked to it.
 */
export async function counterTrade(
  database: Database,
  userId: string,
  tradeId: number,
  input: CounterTradeRequest,
  now = new Date(),
): Promise<TradeDto> {
  return database.transaction(async (tx) => {
    const [current] = await tx.select().from(trades).where(eq(trades.id, tradeId))
    if (!current || current.recipientId !== userId) {
      throw new AppError('NOT_FOUND', `Trade #${tradeId} not found`)
    }
    await lockPlayers(tx, [current.proposerId, current.recipientId])
    const [countered] = await tx
      .update(trades)
      .set({ status: 'countered', respondedAt: now })
      .where(and(eq(trades.id, tradeId), isPendingNow(now)))
      .returning()
    if (!countered) throw new AppError('TRADE_NOT_PENDING', 'This offer is no longer pending')
    await releaseOffer(tx, countered)
    const id = await insertTrade(
      tx,
      {
        proposerId: userId,
        recipientId: current.proposerId,
        ...input,
        parentTradeId: tradeId,
      },
      now,
    )
    return loadTrade(tx, userId, id)
  })
}

/**
 * Accepts an offer atomically (ARCHITECTURE "Trade acceptance"): both players are locked in id
 * order, the proposer's locked copies and the recipient's free copies move. If the recipient no
 * longer has the requested cards, the trade is marked `failed` and nothing moves.
 */
export async function acceptTrade(
  database: Database,
  recipientId: string,
  tradeId: number,
  now = new Date(),
): Promise<{ trade: TradeDto; progression: ProgressionUpdate }> {
  const outcome = await database.transaction(async (tx) => {
    const [current] = await tx.select().from(trades).where(eq(trades.id, tradeId))
    if (!current || current.recipientId !== recipientId) {
      throw new AppError('NOT_FOUND', `Trade #${tradeId} not found`)
    }
    await lockPlayers(tx, [current.proposerId, current.recipientId])
    const [accepted] = await tx
      .update(trades)
      .set({ status: 'accepted', respondedAt: now })
      .where(and(eq(trades.id, tradeId), isPendingNow(now)))
      .returning()
    if (!accepted) throw new AppError('TRADE_NOT_PENDING', 'This offer is no longer pending')

    const items = await tx.select().from(tradeItems).where(eq(tradeItems.tradeId, tradeId))
    const requested = items.filter((item) => item.side === 'recipient')
    if (!(await hasFreeCopies(tx, recipientId, requested))) {
      await tx.update(trades).set({ status: 'failed' }).where(eq(trades.id, tradeId))
      await releaseOffer(tx, accepted)
      return { failed: true as const }
    }

    const receivedBy = new Map<
      string,
      { characterId: number; quantity: number; isNew: boolean }[]
    >()
    for (const item of items) {
      const fromProposer = item.side === 'proposer'
      const to = fromProposer ? accepted.recipientId : accepted.proposerId
      const isNew = await moveCopies(
        tx,
        {
          from: fromProposer ? accepted.proposerId : accepted.recipientId,
          to,
          characterId: item.characterId,
          quantity: item.quantity,
          fromLocked: fromProposer,
        },
        now,
      )
      receivedBy.set(to, [
        ...(receivedBy.get(to) ?? []),
        { characterId: item.characterId, quantity: item.quantity, isNew },
      ])
    }
    await emitEvents(
      tx,
      accepted.proposerId,
      [
        { type: 'trade_completed' },
        ...(await obtainedEvents(tx, receivedBy.get(accepted.proposerId) ?? [])),
      ],
      now,
    )
    const progression = await emitEvents(
      tx,
      recipientId,
      [
        { type: 'trade_completed' },
        ...(await obtainedEvents(tx, receivedBy.get(recipientId) ?? [])),
      ],
      now,
    )
    return { failed: false as const, trade: await loadTrade(tx, recipientId, tradeId), progression }
  })
  if (outcome.failed) {
    throw new AppError('CARD_UNAVAILABLE', 'You no longer have the requested cards: trade failed')
  }
  return { trade: outcome.trade, progression: outcome.progression }
}

async function closeTrade(
  database: Database,
  userId: string,
  tradeId: number,
  as: 'recipient' | 'proposer',
  status: 'declined' | 'cancelled',
  now: Date,
): Promise<TradeDto> {
  return database.transaction(async (tx) => {
    const [current] = await tx.select().from(trades).where(eq(trades.id, tradeId))
    const owner = as === 'recipient' ? current?.recipientId : current?.proposerId
    if (!current || owner !== userId) throw new AppError('NOT_FOUND', `Trade #${tradeId} not found`)
    await lockPlayers(tx, [current.proposerId, current.recipientId])
    const [closed] = await tx
      .update(trades)
      .set({ status, respondedAt: now })
      .where(and(eq(trades.id, tradeId), eq(trades.status, 'pending')))
      .returning()
    if (!closed) throw new AppError('TRADE_NOT_PENDING', 'This offer is no longer pending')
    await releaseOffer(tx, closed)
    return loadTrade(tx, userId, tradeId)
  })
}

export const declineTrade = (
  database: Database,
  userId: string,
  tradeId: number,
  now = new Date(),
) => closeTrade(database, userId, tradeId, 'recipient', 'declined', now)

export const cancelTrade = (
  database: Database,
  userId: string,
  tradeId: number,
  now = new Date(),
) => closeTrade(database, userId, tradeId, 'proposer', 'cancelled', now)

/** Worker sweep: expired offers release their locked copies. */
export async function expireTrades(database: Database, now = new Date()): Promise<number> {
  const due = await database
    .select({ id: trades.id })
    .from(trades)
    .where(and(eq(trades.status, 'pending'), lte(trades.expiresAt, now)))
  let expired = 0
  for (const { id } of due) {
    await database.transaction(async (tx) => {
      const [current] = await tx.select().from(trades).where(eq(trades.id, id))
      if (!current) return
      await lockPlayers(tx, [current.proposerId, current.recipientId])
      const [row] = await tx
        .update(trades)
        .set({ status: 'expired', respondedAt: now })
        .where(and(eq(trades.id, id), eq(trades.status, 'pending')))
        .returning()
      if (row) {
        await releaseOffer(tx, row)
        expired++
      }
    })
  }
  return expired
}

export async function listTrades(
  db: Executor,
  userId: string,
  query: { page: number; pageSize: number; box: 'incoming' | 'outgoing' | 'history' },
  now = new Date(),
): Promise<Paginated<TradeDto> & { pendingIncoming: number }> {
  const where = {
    incoming: and(eq(trades.recipientId, userId), isPendingNow(now)),
    outgoing: and(eq(trades.proposerId, userId), isPendingNow(now)),
    history: and(
      or(eq(trades.proposerId, userId), eq(trades.recipientId, userId)),
      or(ne(trades.status, 'pending'), lte(trades.expiresAt, now)),
    ),
  }[query.box]
  const [rows, [total], [pending]] = await Promise.all([
    db
      .select()
      .from(trades)
      .where(where)
      .orderBy(desc(sql`coalesce(${trades.respondedAt}, ${trades.createdAt})`), desc(trades.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(trades).where(where),
    db
      .select({ value: count() })
      .from(trades)
      .where(and(eq(trades.recipientId, userId), isPendingNow(now))),
  ])
  return {
    items: await toTradeDtos(db, userId, rows),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    pendingIncoming: pending?.value ?? 0,
  }
}

export const getTrade = loadTrade
