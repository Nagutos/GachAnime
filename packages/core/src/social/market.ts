import { alias } from 'drizzle-orm/pg-core'
import {
  characters,
  marketListings,
  playerProfiles,
  rarities,
  userCards,
  users,
  wishlistItems,
  type Database,
  type Executor,
} from '@gachanime/db'
import { periodStartAt, priceInRange } from '@gachanime/game'
import type {
  CreateListingRequest,
  ListingDto,
  MarketQuery,
  MarketRules,
  Paginated,
  ProgressionUpdate,
} from '@gachanime/shared'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { containsPattern } from '../catalog/admin-series'
import { AppError } from '../errors'
import { characterCardColumns, toCharacterCard } from '../players/cards'
import { changeGems, lockPlayer } from '../players/gems'
import { emitEvents } from '../progression/engine'
import { getSetting } from '../settings'
import { lockCopies, lockPlayers, moveCopies, obtainedEvents, unlockCopies } from './inventory'

const sellerProfile = alias(playerProfiles, 'seller_profile')
const sellerUser = alias(users, 'seller_user')
const buyerProfile = alias(playerProfiles, 'buyer_profile')
const buyerUser = alias(users, 'buyer_user')
const viewerCards = alias(userCards, 'viewer_cards')
const viewerWish = alias(wishlistItems, 'viewer_wish')

/** Listings still on sale: active and not past their expiry. */
const onSale = (now: Date) =>
  and(
    eq(marketListings.status, 'active'),
    or(isNull(marketListings.expiresAt), gt(marketListings.expiresAt, now))!,
  )!

function listingQuery(db: Executor, viewerId: string) {
  return db
    .select({
      ...characterCardColumns,
      listingId: marketListings.id,
      status: marketListings.status,
      price: marketListings.price,
      sellerId: marketListings.sellerId,
      sellerUsername: sellerProfile.username,
      sellerName: sellerUser.name,
      sellerAvatar: sellerUser.image,
      buyerUsername: buyerProfile.username,
      buyerName: buyerUser.name,
      buyerAvatar: buyerUser.image,
      inMyWishlist: sql<boolean>`${viewerWish.userId} IS NOT NULL`,
      myQuantity: sql<number>`coalesce(${viewerCards.quantity}, 0)`,
      createdAt: marketListings.createdAt,
      expiresAt: marketListings.expiresAt,
      closedAt: marketListings.closedAt,
    })
    .from(marketListings)
    .innerJoin(characters, eq(characters.id, marketListings.characterId))
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
    .innerJoin(sellerProfile, eq(sellerProfile.userId, marketListings.sellerId))
    .innerJoin(sellerUser, eq(sellerUser.id, marketListings.sellerId))
    .leftJoin(buyerProfile, eq(buyerProfile.userId, marketListings.buyerId))
    .leftJoin(buyerUser, eq(buyerUser.id, marketListings.buyerId))
    .leftJoin(
      viewerWish,
      and(eq(viewerWish.characterId, characters.id), eq(viewerWish.userId, viewerId)),
    )
    .leftJoin(
      viewerCards,
      and(eq(viewerCards.characterId, characters.id), eq(viewerCards.userId, viewerId)),
    )
}
type ListingRow = Awaited<ReturnType<ReturnType<typeof listingQuery>['execute']>>[number]

function toListing(row: ListingRow, viewerId: string): ListingDto {
  return {
    id: row.listingId,
    status: row.status,
    price: row.price,
    character: toCharacterCard(row),
    seller: {
      username: row.sellerUsername,
      displayName: row.sellerName,
      avatarUrl: row.sellerAvatar,
    },
    buyer: row.buyerUsername
      ? {
          username: row.buyerUsername,
          displayName: row.buyerName ?? '',
          avatarUrl: row.buyerAvatar,
        }
      : null,
    isMine: row.sellerId === viewerId,
    inMyWishlist: row.inMyWishlist,
    myQuantity: Number(row.myQuantity),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  }
}

async function loadListing(db: Executor, viewerId: string, id: number): Promise<ListingDto> {
  const [row] = await listingQuery(db, viewerId).where(eq(marketListings.id, id))
  if (!row) throw new AppError('NOT_FOUND', `Listing #${id} not found`)
  return toListing(row, viewerId)
}

/** Sales and purchases of a player since the start of the current day (`missions.reset`). */
async function dailyUsage(db: Executor, userId: string, now: Date) {
  const since = periodStartAt(now, await getSetting(db, 'missions.reset'))
  const [[sales], [purchases]] = await Promise.all([
    db
      .select({ value: count() })
      .from(marketListings)
      .where(
        and(
          eq(marketListings.sellerId, userId),
          eq(marketListings.status, 'sold'),
          gte(marketListings.closedAt, since),
        ),
      ),
    db
      .select({ value: count() })
      .from(marketListings)
      .where(
        and(
          eq(marketListings.buyerId, userId),
          eq(marketListings.status, 'sold'),
          gte(marketListings.closedAt, since),
        ),
      ),
  ])
  return { sales: sales?.value ?? 0, purchases: purchases?.value ?? 0 }
}

async function activeListingCount(db: Executor, userId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(marketListings)
    .where(and(eq(marketListings.sellerId, userId), onSale(now)))
  return row?.value ?? 0
}

export async function getMarketRules(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<MarketRules> {
  const [limits, usage, active, bounds] = await Promise.all([
    getSetting(db, 'market.limits'),
    dailyUsage(db, userId, now),
    activeListingCount(db, userId, now),
    db
      .select({
        rarityKey: rarities.key,
        min: rarities.marketMinPrice,
        max: rarities.marketMaxPrice,
      })
      .from(rarities)
      .orderBy(asc(rarities.sortOrder)),
  ])
  return {
    limits,
    usage: { activeListings: active, salesToday: usage.sales, purchasesToday: usage.purchases },
    priceBounds: bounds.map((row) => ({ ...row, min: Math.max(1, row.min) })),
  }
}

/**
 * Lists one copy for sale (the last copy is allowed, the UI warns). The copy is locked until the
 * listing is sold, withdrawn or expires.
 */
export async function createListing(
  database: Database,
  userId: string,
  input: CreateListingRequest,
  now = new Date(),
): Promise<{ listing: ListingDto; progression: ProgressionUpdate }> {
  return database.transaction(async (tx) => {
    await lockPlayer(tx, userId)
    const limits = await getSetting(tx, 'market.limits')
    if (
      limits.maxActiveListings > 0 &&
      (await activeListingCount(tx, userId, now)) >= limits.maxActiveListings
    ) {
      throw new AppError('MARKET_LIMIT_REACHED', 'Too many active listings', {
        limit: 'maxActiveListings',
      })
    }
    const [character] = await tx
      .select({ min: rarities.marketMinPrice, max: rarities.marketMaxPrice })
      .from(characters)
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .where(eq(characters.id, input.characterId))
    if (!character) throw new AppError('NOT_FOUND', `Character #${input.characterId} not found`)
    if (!priceInRange(input.price, character.min, character.max)) {
      throw new AppError('PRICE_OUT_OF_RANGE', 'The price is outside the allowed range', {
        min: Math.max(1, character.min),
        max: character.max,
      })
    }
    await lockCopies(tx, userId, input.characterId, 1)
    const expiresAt =
      limits.listingTtlDays > 0
        ? new Date(now.getTime() + limits.listingTtlDays * 86_400_000)
        : null
    const [created] = await tx
      .insert(marketListings)
      .values({
        sellerId: userId,
        characterId: input.characterId,
        price: input.price,
        createdAt: now,
        expiresAt,
      })
      .returning({ id: marketListings.id })
    const progression = await emitEvents(tx, userId, [{ type: 'card_listed' }], now)
    return { listing: await loadListing(tx, userId, created!.id), progression }
  })
}

/**
 * Buys a listing atomically: the listing is claimed first with a conditional update, so two
 * buyers can never both get it; then both players are locked in id order, the daily limits and
 * the buyer's gems are checked, gems move (two ledger rows) and the copy moves.
 */
export async function buyListing(
  database: Database,
  buyerId: string,
  listingId: number,
  now = new Date(),
): Promise<{ listing: ListingDto; gemBalance: number; progression: ProgressionUpdate }> {
  return database.transaction(async (tx) => {
    const [listing] = await tx
      .update(marketListings)
      .set({ status: 'sold', buyerId, closedAt: now })
      .where(
        and(eq(marketListings.id, listingId), onSale(now), ne(marketListings.sellerId, buyerId)),
      )
      .returning()
    if (!listing) throw new AppError('LISTING_UNAVAILABLE', 'This listing is no longer for sale')

    const balances = await lockPlayers(tx, [buyerId, listing.sellerId])
    const [limits, buyerUsage, sellerUsage] = await Promise.all([
      getSetting(tx, 'market.limits'),
      dailyUsage(tx, buyerId, now),
      dailyUsage(tx, listing.sellerId, now),
    ])
    // This purchase is already counted (the listing is marked sold).
    if (limits.maxPurchasesPerDay > 0 && buyerUsage.purchases > limits.maxPurchasesPerDay) {
      throw new AppError('MARKET_LIMIT_REACHED', 'Daily purchase limit reached', {
        limit: 'maxPurchasesPerDay',
      })
    }
    if (limits.maxSalesPerDay > 0 && sellerUsage.sales > limits.maxSalesPerDay) {
      throw new AppError('MARKET_LIMIT_REACHED', 'The seller reached their daily sale limit', {
        limit: 'maxSalesPerDay',
      })
    }
    if ((balances.get(buyerId) ?? 0) < listing.price) {
      throw new AppError('NOT_ENOUGH_GEMS', 'Not enough gems', { required: listing.price })
    }

    const gemBalance = await changeGems(tx, {
      userId: buyerId,
      amount: -listing.price,
      reason: 'market_purchase',
      refType: 'listing',
      refId: listing.id,
    })
    await changeGems(tx, {
      userId: listing.sellerId,
      amount: listing.price,
      reason: 'market_sale',
      refType: 'listing',
      refId: listing.id,
    })
    const isNew = await moveCopies(
      tx,
      {
        from: listing.sellerId,
        to: buyerId,
        characterId: listing.characterId,
        quantity: 1,
        fromLocked: true,
      },
      now,
    )

    const [rarity] = await tx
      .select({ key: rarities.key })
      .from(characters)
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .where(eq(characters.id, listing.characterId))
    await emitEvents(
      tx,
      listing.sellerId,
      [{ type: 'card_sold', rarity: rarity?.key ?? 'common' }],
      now,
    )
    const progression = await emitEvents(
      tx,
      buyerId,
      [
        { type: 'card_bought' },
        ...(await obtainedEvents(tx, [{ characterId: listing.characterId, quantity: 1, isNew }])),
      ],
      now,
    )
    return { listing: await loadListing(tx, buyerId, listing.id), gemBalance, progression }
  })
}

export async function withdrawListing(
  database: Database,
  sellerId: string,
  listingId: number,
  now = new Date(),
): Promise<ListingDto> {
  return database.transaction(async (tx) => {
    await lockPlayer(tx, sellerId)
    const [listing] = await tx
      .update(marketListings)
      .set({ status: 'withdrawn', closedAt: now })
      .where(
        and(
          eq(marketListings.id, listingId),
          eq(marketListings.sellerId, sellerId),
          eq(marketListings.status, 'active'),
        ),
      )
      .returning()
    if (!listing) throw new AppError('LISTING_UNAVAILABLE', 'This listing is not active')
    await unlockCopies(tx, sellerId, listing.characterId, 1)
    return loadListing(tx, sellerId, listing.id)
  })
}

/** Worker sweep: expired listings release their copy. */
export async function expireListings(database: Database, now = new Date()): Promise<number> {
  const due = await database
    .select({ id: marketListings.id, sellerId: marketListings.sellerId })
    .from(marketListings)
    .where(and(eq(marketListings.status, 'active'), lte(marketListings.expiresAt, now)))
  let expired = 0
  for (const listing of due) {
    await database.transaction(async (tx) => {
      await lockPlayer(tx, listing.sellerId)
      const [row] = await tx
        .update(marketListings)
        .set({ status: 'expired', closedAt: now })
        .where(and(eq(marketListings.id, listing.id), eq(marketListings.status, 'active')))
        .returning()
      if (row) {
        await unlockCopies(tx, row.sellerId, row.characterId, 1)
        expired++
      }
    })
  }
  return expired
}

/** Listings on sale, with wishlist highlight (GAME_DESIGN §4). */
export async function browseListings(
  db: Executor,
  viewerId: string,
  query: MarketQuery,
  now = new Date(),
): Promise<Paginated<ListingDto>> {
  const conditions: SQL[] = [onSale(now)]
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(or(ilike(characters.nameFull, pattern), ilike(characters.nameNative, pattern))!)
  }
  if (query.rarity) conditions.push(eq(rarities.key, query.rarity))
  if (query.wishlist) conditions.push(sql`${viewerWish.userId} IS NOT NULL`)
  if (query.missing) conditions.push(sql`coalesce(${viewerCards.quantity}, 0) = 0`)
  const where = and(...conditions)
  const order = {
    recent: [desc(marketListings.createdAt), desc(marketListings.id)],
    price_asc: [asc(marketListings.price), desc(marketListings.id)],
    price_desc: [desc(marketListings.price), desc(marketListings.id)],
    rarity: [desc(rarities.sortOrder), asc(marketListings.price), desc(marketListings.id)],
  }[query.sort]
  const [rows, [total]] = await Promise.all([
    listingQuery(db, viewerId)
      .where(where)
      .orderBy(...order)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(marketListings)
      .innerJoin(characters, eq(characters.id, marketListings.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .leftJoin(
        viewerWish,
        and(eq(viewerWish.characterId, characters.id), eq(viewerWish.userId, viewerId)),
      )
      .leftJoin(
        viewerCards,
        and(eq(viewerCards.characterId, characters.id), eq(viewerCards.userId, viewerId)),
      )
      .where(where),
  ])
  return {
    items: rows.map((row) => toListing(row, viewerId)),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/** The player's own listings: active ones, or closed (sold, withdrawn, expired) plus purchases. */
export async function myListings(
  db: Executor,
  userId: string,
  query: { page: number; pageSize: number; status: 'active' | 'closed' },
): Promise<Paginated<ListingDto>> {
  const where =
    query.status === 'active'
      ? and(eq(marketListings.sellerId, userId), eq(marketListings.status, 'active'))
      : or(
          and(eq(marketListings.sellerId, userId), ne(marketListings.status, 'active')),
          eq(marketListings.buyerId, userId),
        )
  const [rows, [total]] = await Promise.all([
    listingQuery(db, userId)
      .where(where)
      .orderBy(
        sql`coalesce(${marketListings.closedAt}, ${marketListings.createdAt}) DESC`,
        desc(marketListings.id),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(marketListings).where(where),
  ])
  return {
    items: rows.map((row) => toListing(row, userId)),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}
