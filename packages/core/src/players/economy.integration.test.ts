import {
  adminAuditLog,
  boosterTiers,
  characters,
  gemTransactions,
  playerProfiles,
  userCards,
  type Database,
} from '@gachanime/db'
import { seededRng } from '@gachanime/game'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getAdminSettings,
  listAdminRarities,
  updateBoosterTier,
  updateRarity,
  updateSetting,
} from '../admin/economy'
import { openBoosters } from '../boosters/boosters'
import { RarityTable } from '../catalog/rarities'
import { insertSeriesWithCharacters } from '../test/catalog-fixture'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import { adjustGems, listGemHistory } from './gems'
import { ensurePlayerProfile } from './profile'
import { previewRecycleDuplicates, recycleAllDuplicates, recycleCards } from './recycle'

const NOW = new Date('2026-10-07T12:00:00Z')
const actor = { actorId: 'admin', ip: null }

describe.skipIf(!testDatabaseUrl)('economy (integration)', () => {
  let db: Database
  let close: () => Promise<void>
  let ids: Record<string, number>

  async function balance(userId = 'p1'): Promise<number> {
    const [row] = await db
      .select({ gemBalance: playerProfiles.gemBalance })
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, userId))
    return row!.gemBalance
  }

  /** Ledger invariant: the sum of a player's transactions equals the balance. */
  async function expectLedgerMatches(userId = 'p1'): Promise<void> {
    const [row] = await db
      .select({ sum: sql<number>`coalesce(sum(${gemTransactions.amount}), 0)::int` })
      .from(gemTransactions)
      .where(eq(gemTransactions.userId, userId))
    expect(row!.sum).toBe(await balance(userId))
  }

  async function setCards(name: string, quantity: number, lockedQuantity = 0): Promise<void> {
    await db
      .insert(userCards)
      .values({ userId: 'p1', characterId: ids[name]!, quantity, lockedQuantity })
      .onConflictDoUpdate({
        target: [userCards.userId, userCards.characterId],
        set: { quantity, lockedQuantity },
      })
  }

  async function quantityOf(name: string): Promise<number> {
    const [row] = await db
      .select({ quantity: userCards.quantity })
      .from(userCards)
      .where(and(eq(userCards.userId, 'p1'), eq(userCards.characterId, ids[name]!)))
    return row?.quantity ?? 0
  }

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => {
    await resetTestDatabase(db)
    await insertDiscordUser(db, { id: 'admin', name: 'Admin', discordId: '300000000000000001' })
    await insertDiscordUser(db, { id: 'p1', name: 'Player', discordId: '300000000000000002' })
    await ensurePlayerProfile(db, { userId: 'p1', displayName: 'Player' })
    ;({ ids } = await insertSeriesWithCharacters(db, { slug: 'eco', title: 'Eco' }, [
      { name: 'Common A', rarity: 'common' },
      { name: 'Rare A', rarity: 'rare' },
      { name: 'Epic A', rarity: 'epic' },
      { name: 'Legendary A', rarity: 'legendary' },
      { name: 'Mythic A', rarity: 'mythic' },
    ]))
  })

  describe('paid boosters', () => {
    it('refuses without enough gems and changes nothing', async () => {
      await adjustGems(db, { userId: 'p1', amount: 149, note: 'test' }, actor)
      await expect(
        openBoosters(db, 'p1', { tier: 'epic', quantity: 1 }, { now: NOW }),
      ).rejects.toMatchObject({ code: 'NOT_ENOUGH_GEMS', details: { required: 150 } })
      expect(await balance()).toBe(149)
      await expectLedgerMatches()
    })

    it('debits the price, writes the ledger and leaves the free charges alone', async () => {
      await adjustGems(db, { userId: 'p1', amount: 2000, note: 'test' }, actor)
      const result = await openBoosters(
        db,
        'p1',
        { tier: 'epic', quantity: 10 },
        { now: NOW, rng: seededRng(2) },
      )
      expect(result).toMatchObject({ gemsSpent: 1500, gemBalance: 500, quantity: 10 })
      expect(result.cards).toHaveLength(50)
      expect(result.free.available).toBe(15)
      const [purchase] = await db
        .select()
        .from(gemTransactions)
        .where(eq(gemTransactions.reason, 'booster_purchase'))
      expect(purchase).toMatchObject({
        amount: -1500,
        balanceAfter: 500,
        refType: 'booster_opening',
      })
      await expectLedgerMatches()
    })

    it('never draws below Epic in a Divine booster', async () => {
      await adjustGems(db, { userId: 'p1', amount: 50_000, note: 'test' }, actor)
      const result = await openBoosters(
        db,
        'p1',
        { tier: 'divine', quantity: 10 },
        { now: NOW, rng: seededRng(8) },
      )
      const rarities = new Set(result.cards.map((card) => card.character.rarityKey))
      expect([...rarities].every((key) => ['epic', 'legendary', 'mythic'].includes(key))).toBe(true)
    })

    it('never overspends under concurrent purchases', async () => {
      await adjustGems(db, { userId: 'p1', amount: 1000, note: 'test' }, actor)
      const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          openBoosters(db, 'p1', { tier: 'legendary', quantity: 1 }, { now: NOW }),
        ),
      )
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(2)
      expect(await balance()).toBe(0)
      await expectLedgerMatches()
    })
  })

  describe('recycling', () => {
    it('recycles duplicates, never the first copy nor locked copies', async () => {
      await setCards('Epic A', 5, 2)
      const result = await recycleCards(db, 'p1', { characterId: ids['Epic A']!, count: 2 })
      expect(result).toMatchObject({ cards: 2, gems: 20, gemBalance: 20 })
      expect(await quantityOf('Epic A')).toBe(3)
      // 3 copies, 2 locked: the remaining one is the first copy.
      await expect(
        recycleCards(db, 'p1', { characterId: ids['Epic A']!, count: 1 }),
      ).rejects.toMatchObject({ code: 'NOTHING_TO_RECYCLE', details: { available: 0 } })
      await setCards('Rare A', 1)
      await expect(
        recycleCards(db, 'p1', { characterId: ids['Rare A']!, count: 1 }),
      ).rejects.toMatchObject({ code: 'NOTHING_TO_RECYCLE' })
      await expectLedgerMatches()
    })

    it('previews and recycles every duplicate with a rarity filter', async () => {
      await setCards('Common A', 4)
      await setCards('Rare A', 3, 1)
      await setCards('Legendary A', 2)
      await setCards('Mythic A', 1)

      const preview = await previewRecycleDuplicates(db, 'p1', {})
      expect(preview).toEqual({
        cards: 3 + 1 + 1,
        characters: 3,
        gems: 3 * 1 + 1 * 2 + 1 * 50,
        byRarity: [
          { rarityKey: 'common', cards: 3, gems: 3 },
          { rarityKey: 'rare', cards: 1, gems: 2 },
          { rarityKey: 'legendary', cards: 1, gems: 50 },
        ],
      })

      const filter = { rarities: ['common', 'rare'] }
      const filtered = await previewRecycleDuplicates(db, 'p1', filter)
      expect(filtered).toMatchObject({ cards: 4, gems: 5 })
      const result = await recycleAllDuplicates(db, 'p1', {
        ...filter,
        expected: { cards: 4, gems: 5 },
      })
      expect(result).toMatchObject({ cards: 4, gems: 5, gemBalance: 5 })
      expect(await quantityOf('Common A')).toBe(1)
      expect(await quantityOf('Rare A')).toBe(2) // first copy + locked copy
      expect(await quantityOf('Legendary A')).toBe(2)
      await expectLedgerMatches()
    })

    it('refuses an outdated preview and an empty recycle', async () => {
      await setCards('Common A', 3)
      await expect(
        recycleAllDuplicates(db, 'p1', { expected: { cards: 1, gems: 1 } }),
      ).rejects.toMatchObject({ code: 'PREVIEW_OUTDATED', details: { cards: 2, gems: 2 } })
      expect(await quantityOf('Common A')).toBe(3)
      await setCards('Common A', 1)
      await expect(
        recycleAllDuplicates(db, 'p1', { expected: { cards: 0, gems: 0 } }),
      ).rejects.toMatchObject({ code: 'NOTHING_TO_RECYCLE' })
    })

    it('lists the gem history, newest first', async () => {
      await adjustGems(db, { userId: 'p1', amount: 100, note: 'gift' }, actor)
      await setCards('Rare A', 2)
      await recycleCards(db, 'p1', { characterId: ids['Rare A']!, count: 1 })
      const history = await listGemHistory(db, 'p1', { page: 1, pageSize: 10 })
      expect(history.gemBalance).toBe(102)
      expect(history.items.map((item) => [item.reason, item.amount, item.balanceAfter])).toEqual([
        ['recycle', 2, 102],
        ['admin_adjustment', 100, 100],
      ])
      expect(await db.select().from(adminAuditLog)).toHaveLength(1)
    })
  })

  describe('admin', () => {
    it('re-applies default rarities when a threshold changes, keeping overrides', async () => {
      const table = await RarityTable.load(db)
      const insert = (anilistId: number, favourites: number, overridden = false) =>
        db
          .insert(characters)
          .values({
            source: 'anilist',
            anilistId,
            nameFull: `AniList ${anilistId}`,
            favourites,
            rarityId: table.idForFavourites(favourites),
            rarityOverridden: overridden,
          })
          .returning({ id: characters.id })
      // Legendary with the default thresholds (8 000 ≤ favourites < 20 000).
      const [famous] = await insert(1, 15_000)
      const [pinned] = await insert(2, 15_000, true)

      const result = await updateRarity(db, 'mythic', { favouritesThreshold: 12_000 }, actor)
      expect(result.recomputedCharacters).toBe(1)
      const rarityOf = async (id: number) =>
        (await db.query.characters.findFirst({ where: eq(characters.id, id) }))!.rarityId
      expect(await rarityOf(famous!.id)).toBe(table.idForKey('mythic'))
      expect(await rarityOf(pinned!.id)).toBe(table.idForKey('legendary'))

      await expect(
        updateRarity(db, 'mythic', { favouritesThreshold: 5_000 }, actor),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
      await expect(
        updateRarity(db, 'rare', { marketMinPrice: 500, marketMaxPrice: 100 }, actor),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
      await updateRarity(db, 'rare', { recycleValue: 3 }, actor)
      expect((await listAdminRarities(db)).find((rarity) => rarity.key === 'rare')).toMatchObject({
        recycleValue: 3,
      })
    })

    it('re-applies game popularity thresholds to IGDB characters only', async () => {
      const table = await RarityTable.load(db)
      const [hero] = await db
        .insert(characters)
        .values({
          source: 'igdb',
          igdbId: 1,
          nameFull: 'Game hero',
          gamePopularity: 800,
          rarityId: table.idForGamePopularity(800),
        })
        .returning({ id: characters.id })
      const [anime] = await db
        .insert(characters)
        .values({
          source: 'anilist',
          anilistId: 1,
          nameFull: 'Anime hero',
          favourites: 800,
          rarityId: table.idForFavourites(800),
        })
        .returning({ id: characters.id })
      const rarityOf = async (id: number) =>
        table.keyForId(
          (await db.query.characters.findFirst({ where: eq(characters.id, id) }))!.rarityId,
        )
      expect(await rarityOf(hero!.id)).toBe('epic')

      const result = await updateRarity(db, 'legendary', { gamePopularityThreshold: 700 }, actor)
      expect(result.recomputedCharacters).toBe(1)
      expect(await rarityOf(hero!.id)).toBe('legendary')
      expect(await rarityOf(anime!.id)).toBe('rare')

      // Thresholds of each kind must increase with the rarity order.
      await expect(
        updateRarity(db, 'mythic', { gamePopularityThreshold: 100 }, actor),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })

    it('edits booster tiers with valid weights only', async () => {
      const weights = { common: 0, rare: 0, epic: 500_000, legendary: 400_000, mythic: 100_000 }
      await updateBoosterTier(db, 'divine', { weights, priceGems: 4000 }, actor)
      const [divine] = await db.select().from(boosterTiers).where(eq(boosterTiers.key, 'divine'))
      expect(divine).toMatchObject({ weights, priceGems: 4000 })

      await expect(
        updateBoosterTier(db, 'divine', { weights: { epic: 500_000, cosmic: 500_000 } }, actor),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
      await expect(updateBoosterTier(db, 'free', { priceGems: 10 }, actor)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      })
    })

    it('validates and audits settings', async () => {
      await updateSetting(db, 'boosters.free', { intervalSeconds: 300, maxCharges: 20 }, actor)
      expect((await getAdminSettings(db))['boosters.free']).toEqual({
        intervalSeconds: 300,
        maxCharges: 20,
      })
      await expect(
        updateSetting(db, 'boosters.free', { intervalSeconds: 1, maxCharges: 20 }, actor),
      ).rejects.toThrow()
      const audit = await db.select().from(adminAuditLog)
      expect(audit.map((row) => row.action)).toEqual(['setting.update'])
    })
  })
})
