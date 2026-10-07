import {
  gemTransactions,
  marketListings,
  playerProfiles,
  settings,
  trades,
  userCards,
  users,
  type Database,
} from '@gachanime/db'
import { marketQuerySchema, playerCardsQuerySchema } from '@gachanime/shared'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { adjustGems } from '../players/gems'
import { ensurePlayerProfile } from '../players/profile'
import { recycleCards } from '../players/recycle'
import { setWishlisted } from '../players/wishlist'
import { listAchievements } from '../progression/objectives'
import { insertSeriesWithCharacters } from '../test/catalog-fixture'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import {
  browseListings,
  buyListing,
  createListing,
  expireListings,
  getMarketRules,
  myListings,
  withdrawListing,
} from './market'
import { getPlayerProfile, listPlayerCards, listPlayers } from './players'
import {
  acceptTrade,
  cancelTrade,
  counterTrade,
  declineTrade,
  expireTrades,
  listTrades,
  proposeTrade,
} from './trades'

const NOW = new Date('2026-10-07T12:00:00Z')
const actor = { actorId: null, ip: null }

describe.skipIf(!testDatabaseUrl)('social: market, trades, profiles (integration)', () => {
  let db: Database
  let close: () => Promise<void>
  let ids: Record<string, number>

  async function cards(userId: string, name: string) {
    const [row] = await db
      .select({ quantity: userCards.quantity, locked: userCards.lockedQuantity })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), eq(userCards.characterId, ids[name]!)))
    return row ?? { quantity: 0, locked: 0 }
  }
  async function give(userId: string, name: string, quantity: number) {
    await db.insert(userCards).values({ userId, characterId: ids[name]!, quantity })
  }
  async function balance(userId: string) {
    const [row] = await db
      .select({ gemBalance: playerProfiles.gemBalance })
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, userId))
    return row!.gemBalance
  }
  async function ledgerMatches(userId: string) {
    const [row] = await db
      .select({ sum: sql<number>`coalesce(sum(${gemTransactions.amount}), 0)::int` })
      .from(gemTransactions)
      .where(eq(gemTransactions.userId, userId))
    expect(row!.sum).toBe(await balance(userId))
  }

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => {
    await resetTestDatabase(db)
    for (const [id, name, discordId] of [
      ['alice', 'Alice', '600000000000000001'],
      ['bob', 'Bob', '600000000000000002'],
      ['carol', 'Carol', '600000000000000003'],
    ] as const) {
      await insertDiscordUser(db, { id, name, discordId })
      await ensurePlayerProfile(db, { userId: id, displayName: name })
    }
    ;({ ids } = await insertSeriesWithCharacters(db, { slug: 'social', title: 'Social' }, [
      { name: 'Common A', rarity: 'common' },
      { name: 'Rare A', rarity: 'rare' },
      { name: 'Epic A', rarity: 'epic' },
      { name: 'Legendary A', rarity: 'legendary' },
    ]))
  })

  describe('market', () => {
    it('lists, sells and moves gems and the card atomically', async () => {
      await give('alice', 'Epic A', 1)
      await adjustGems(db, { userId: 'bob', amount: 100, note: 'test' }, actor)
      const { listing } = await createListing(
        db,
        'alice',
        { characterId: ids['Epic A']!, price: 40 },
        NOW,
      )
      expect(listing).toMatchObject({ status: 'active', price: 40, isMine: true })
      // The last copy may be sold; it is locked while listed and cannot be listed twice.
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 1, locked: 1 })
      await expect(
        createListing(db, 'alice', { characterId: ids['Epic A']!, price: 40 }, NOW),
      ).rejects.toMatchObject({ code: 'CARD_UNAVAILABLE' })

      await expect(buyListing(db, 'alice', listing.id, NOW)).rejects.toMatchObject({
        code: 'LISTING_UNAVAILABLE',
      })
      const bought = await buyListing(db, 'bob', listing.id, NOW)
      expect(bought).toMatchObject({ gemBalance: 60, listing: { status: 'sold' } })
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 0, locked: 0 })
      expect(await cards('bob', 'Epic A')).toEqual({ quantity: 1, locked: 0 })
      expect(await balance('alice')).toBe(40)
      await ledgerMatches('alice')
      await ledgerMatches('bob')

      const done = await listAchievements(db, 'alice', 'completed')
      expect(done.items.map((item) => item.key)).toContain('sell_1')
      expect((await myListings(db, 'bob', { page: 1, pageSize: 10, status: 'closed' })).total).toBe(
        1,
      )
    })

    it('never sells a listing twice under concurrent purchases', async () => {
      await give('alice', 'Rare A', 2)
      await adjustGems(db, { userId: 'bob', amount: 50, note: 'test' }, actor)
      await adjustGems(db, { userId: 'carol', amount: 50, note: 'test' }, actor)
      const { listing } = await createListing(
        db,
        'alice',
        { characterId: ids['Rare A']!, price: 10 },
        NOW,
      )
      const attempts = await Promise.allSettled([
        buyListing(db, 'bob', listing.id, NOW),
        buyListing(db, 'carol', listing.id, NOW),
      ])
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1)
      expect(await balance('alice')).toBe(10)
      expect((await balance('bob')) + (await balance('carol'))).toBe(90)
      expect(await cards('alice', 'Rare A')).toEqual({ quantity: 1, locked: 0 })
    })

    it('keeps the listing on sale when the buyer cannot pay', async () => {
      await give('alice', 'Rare A', 2)
      const { listing } = await createListing(
        db,
        'alice',
        { characterId: ids['Rare A']!, price: 10 },
        NOW,
      )
      await expect(buyListing(db, 'bob', listing.id, NOW)).rejects.toMatchObject({
        code: 'NOT_ENOUGH_GEMS',
      })
      const shop = await browseListings(db, 'bob', marketQuerySchema.parse({}), NOW)
      expect(shop.items.map((item) => item.id)).toEqual([listing.id])
    })

    it('enforces price bounds and the market limits', async () => {
      await give('alice', 'Rare A', 5)
      await expect(
        createListing(db, 'alice', { characterId: ids['Rare A']!, price: 1 }, NOW),
      ).rejects.toMatchObject({ code: 'PRICE_OUT_OF_RANGE', details: { min: 2, max: 200 } })
      await db
        .update(settings)
        .set({
          value: {
            maxActiveListings: 2,
            maxSalesPerDay: 0,
            maxPurchasesPerDay: 1,
            listingTtlDays: 7,
          },
        })
        .where(eq(settings.key, 'market.limits'))
      const first = await createListing(db, 'alice', { characterId: ids['Rare A']!, price: 5 }, NOW)
      await createListing(db, 'alice', { characterId: ids['Rare A']!, price: 6 }, NOW)
      await expect(
        createListing(db, 'alice', { characterId: ids['Rare A']!, price: 7 }, NOW),
      ).rejects.toMatchObject({ code: 'MARKET_LIMIT_REACHED' })

      await adjustGems(db, { userId: 'bob', amount: 100, note: 'test' }, actor)
      await buyListing(db, 'bob', first.listing.id, NOW)
      const second = (await myListings(db, 'alice', { page: 1, pageSize: 10, status: 'active' }))
        .items[0]!
      await expect(buyListing(db, 'bob', second.id, NOW)).rejects.toMatchObject({
        code: 'MARKET_LIMIT_REACHED',
      })
      expect((await getMarketRules(db, 'bob', NOW)).usage.purchasesToday).toBe(1)
    })

    it('releases the copy on withdrawal and expiry, and locked copies are never recycled', async () => {
      await give('alice', 'Common A', 2)
      const { listing } = await createListing(
        db,
        'alice',
        { characterId: ids['Common A']!, price: 3 },
        NOW,
      )
      await expect(
        recycleCards(db, 'alice', { characterId: ids['Common A']!, count: 1 }),
      ).rejects.toMatchObject({ code: 'NOTHING_TO_RECYCLE' })
      await withdrawListing(db, 'alice', listing.id, NOW)
      expect(await cards('alice', 'Common A')).toEqual({ quantity: 2, locked: 0 })

      await createListing(db, 'alice', { characterId: ids['Common A']!, price: 3 }, NOW)
      expect(await expireListings(db, new Date(NOW.getTime() + 8 * 86_400_000))).toBe(1)
      expect(await cards('alice', 'Common A')).toEqual({ quantity: 2, locked: 0 })
      const [expired] = await db
        .select()
        .from(marketListings)
        .where(eq(marketListings.status, 'expired'))
      expect(expired).toBeTruthy()
    })

    it('highlights wishlisted cards and can hide owned ones', async () => {
      await give('alice', 'Epic A', 2)
      await give('alice', 'Rare A', 2)
      await give('bob', 'Rare A', 1)
      await setWishlisted(db, 'bob', ids['Epic A']!, true)
      await createListing(db, 'alice', { characterId: ids['Epic A']!, price: 20 }, NOW)
      await createListing(db, 'alice', { characterId: ids['Rare A']!, price: 5 }, NOW)
      const wished = await browseListings(
        db,
        'bob',
        marketQuerySchema.parse({ wishlist: 'true' }),
        NOW,
      )
      expect(wished.items.map((item) => item.character.name)).toEqual(['Epic A'])
      expect(wished.items[0]!.inMyWishlist).toBe(true)
      const missing = await browseListings(
        db,
        'bob',
        marketQuerySchema.parse({ missing: 'true' }),
        NOW,
      )
      expect(missing.items.map((item) => item.character.name)).toEqual(['Epic A'])
      const byPrice = await browseListings(
        db,
        'bob',
        marketQuerySchema.parse({ sort: 'price_asc' }),
        NOW,
      )
      expect(byPrice.items.map((item) => item.price)).toEqual([5, 20])
    })
  })

  describe('trades', () => {
    beforeEach(async () => {
      await give('alice', 'Epic A', 1)
      await give('bob', 'Rare A', 2)
    })

    it('locks the offer, then swaps the cards on acceptance', async () => {
      const trade = await proposeTrade(
        db,
        'alice',
        {
          recipient: 'bob',
          offer: [{ characterId: ids['Epic A']!, quantity: 1 }],
          request: [{ characterId: ids['Rare A']!, quantity: 2 }],
          message: 'Deal?',
        },
        NOW,
      )
      expect(trade).toMatchObject({
        status: 'pending',
        outgoing: true,
        counterpart: { username: 'bob' },
      })
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 1, locked: 1 })

      const incoming = await listTrades(db, 'bob', { page: 1, pageSize: 10, box: 'incoming' }, NOW)
      expect(incoming.pendingIncoming).toBe(1)
      expect(incoming.items[0]).toMatchObject({
        outgoing: false,
        give: [{ quantity: 2, character: { name: 'Rare A' } }],
        receive: [{ quantity: 1, character: { name: 'Epic A' } }],
      })

      const { trade: accepted } = await acceptTrade(db, 'bob', trade.id, NOW)
      expect(accepted.status).toBe('accepted')
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 0, locked: 0 })
      expect(await cards('alice', 'Rare A')).toEqual({ quantity: 2, locked: 0 })
      expect(await cards('bob', 'Epic A')).toEqual({ quantity: 1, locked: 0 })
      expect(await cards('bob', 'Rare A')).toEqual({ quantity: 0, locked: 0 })
      for (const player of ['alice', 'bob']) {
        const done = await listAchievements(db, player, 'completed')
        expect(done.items.map((item) => item.key)).toContain('trade_1')
      }
      await expect(acceptTrade(db, 'bob', trade.id, NOW)).rejects.toMatchObject({
        code: 'TRADE_NOT_PENDING',
      })
    })

    it('fails cleanly when the requested card vanished before acceptance', async () => {
      const trade = await proposeTrade(
        db,
        'alice',
        {
          recipient: 'bob',
          offer: [{ characterId: ids['Epic A']!, quantity: 1 }],
          request: [{ characterId: ids['Rare A']!, quantity: 2 }],
        },
        NOW,
      )
      // Bob recycles one of the two requested copies.
      await recycleCards(db, 'bob', { characterId: ids['Rare A']!, count: 1 })
      await expect(acceptTrade(db, 'bob', trade.id, NOW)).rejects.toMatchObject({
        code: 'CARD_UNAVAILABLE',
      })
      const [row] = await db.select().from(trades).where(eq(trades.id, trade.id))
      expect(row!.status).toBe('failed')
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 1, locked: 0 })
      expect(await cards('bob', 'Rare A')).toEqual({ quantity: 1, locked: 0 })
    })

    it('counters, declines, cancels and expires offers, always releasing locks', async () => {
      const offer = {
        recipient: 'bob',
        offer: [{ characterId: ids['Epic A']!, quantity: 1 }],
        request: [{ characterId: ids['Rare A']!, quantity: 1 }],
      }
      const first = await proposeTrade(db, 'alice', offer, NOW)
      const counter = await counterTrade(
        db,
        'bob',
        first.id,
        {
          offer: [{ characterId: ids['Rare A']!, quantity: 1 }],
          request: [{ characterId: ids['Epic A']!, quantity: 1 }],
          message: 'Only one rare',
        },
        NOW,
      )
      expect(counter).toMatchObject({ status: 'pending', outgoing: true, parentTradeId: first.id })
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 1, locked: 0 })
      expect(await cards('bob', 'Rare A')).toEqual({ quantity: 2, locked: 1 })

      await declineTrade(db, 'alice', counter.id, NOW)
      expect(await cards('bob', 'Rare A')).toEqual({ quantity: 2, locked: 0 })

      const again = await proposeTrade(db, 'alice', offer, NOW)
      await expect(cancelTrade(db, 'bob', again.id, NOW)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      await cancelTrade(db, 'alice', again.id, NOW)
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 1, locked: 0 })

      await db
        .update(settings)
        .set({ value: { offerTtlDays: 1 } })
        .where(eq(settings.key, 'trades.offers'))
      const expiring = await proposeTrade(db, 'alice', offer, NOW)
      const later = new Date(NOW.getTime() + 2 * 86_400_000)
      await expect(acceptTrade(db, 'bob', expiring.id, later)).rejects.toMatchObject({
        code: 'TRADE_NOT_PENDING',
      })
      expect(await expireTrades(db, later)).toBe(1)
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 1, locked: 0 })
      const history = await listTrades(
        db,
        'alice',
        { page: 1, pageSize: 10, box: 'history' },
        later,
      )
      expect(history.items.map((item) => item.status)).toEqual(
        expect.arrayContaining(['countered', 'declined', 'cancelled', 'expired']),
      )
    })

    it('refuses invalid offers', async () => {
      await expect(
        proposeTrade(db, 'alice', {
          recipient: 'alice',
          offer: [{ characterId: ids['Epic A']!, quantity: 1 }],
          request: [{ characterId: ids['Rare A']!, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: 'INVALID_TRADE' })
      await expect(
        proposeTrade(db, 'alice', {
          recipient: 'bob',
          offer: [{ characterId: ids['Epic A']!, quantity: 2 }],
          request: [{ characterId: ids['Rare A']!, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: 'CARD_UNAVAILABLE' })
      await expect(
        proposeTrade(db, 'alice', {
          recipient: 'bob',
          offer: [{ characterId: ids['Epic A']!, quantity: 1 }],
          request: [{ characterId: ids['Legendary A']!, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: 'CARD_UNAVAILABLE' })
      expect(await cards('alice', 'Epic A')).toEqual({ quantity: 1, locked: 0 })
      await db.update(users).set({ banned: true }).where(eq(users.id, 'bob'))
      await expect(
        proposeTrade(db, 'alice', {
          recipient: 'bob',
          offer: [{ characterId: ids['Epic A']!, quantity: 1 }],
          request: [{ characterId: ids['Rare A']!, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: 'PLAYER_BANNED' })
    })

    it('accepts crossing trades concurrently without deadlock', async () => {
      await give('alice', 'Common A', 1)
      await give('bob', 'Legendary A', 1)
      const aliceToBob = await proposeTrade(db, 'alice', {
        recipient: 'bob',
        offer: [{ characterId: ids['Epic A']!, quantity: 1 }],
        request: [{ characterId: ids['Rare A']!, quantity: 1 }],
      })
      const bobToAlice = await proposeTrade(db, 'bob', {
        recipient: 'alice',
        offer: [{ characterId: ids['Legendary A']!, quantity: 1 }],
        request: [{ characterId: ids['Common A']!, quantity: 1 }],
      })
      const results = await Promise.allSettled([
        acceptTrade(db, 'bob', aliceToBob.id),
        acceptTrade(db, 'alice', bobToAlice.id),
      ])
      expect(results.every((result) => result.status === 'fulfilled')).toBe(true)
      expect(await cards('alice', 'Legendary A')).toEqual({ quantity: 1, locked: 0 })
      expect(await cards('bob', 'Epic A')).toEqual({ quantity: 1, locked: 0 })
    })
  })

  describe('profiles', () => {
    it('shows public stats and cards with wishlist highlights', async () => {
      await give('alice', 'Epic A', 3)
      await give('alice', 'Rare A', 1)
      await setWishlisted(db, 'bob', ids['Epic A']!, true)
      await setWishlisted(db, 'alice', ids['Epic A']!, true)
      const profile = await getPlayerProfile(db, 'bob', 'Alice')
      expect(profile).toMatchObject({
        username: 'alice',
        isMe: false,
        stats: { owned: 2, cards: 4, catalog: 4 },
      })
      const aliceCards = await listPlayerCards(
        db,
        'alice',
        'bob',
        playerCardsQuerySchema.parse({ viewerWishlist: 'true' }),
      )
      expect(aliceCards.items).toEqual([
        expect.objectContaining({
          name: 'Epic A',
          quantity: 3,
          tradable: 3,
          inViewerWishlist: true,
          inOwnerWishlist: true,
        }),
      ])
      await db.update(users).set({ banned: true }).where(eq(users.id, 'carol'))
      const players = await listPlayers(db, { page: 1, pageSize: 10 })
      expect(players.items.map((player) => player.username)).toEqual(['alice', 'bob'])
    })
  })
})
