import {
  boosterOpeningCards,
  boosterOpenings,
  playerProfiles,
  settings,
  userCards,
  type Database,
} from '@gachanime/db'
import { seededRng, type Rng } from '@gachanime/game'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../errors'
import { ensurePlayerProfile } from '../players/profile'
import { setWishlisted } from '../players/wishlist'
import { insertSeriesWithCharacters } from '../test/catalog-fixture'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import { getFreeBoosterStatus, listBoosters, openBoosters } from './boosters'

const NOW = new Date('2026-10-07T12:00:00Z')
const INTERVAL_MS = 600_000

/** Returns the scripted values in order, then defers to a seeded generator. */
function scriptedRng(values: number[]): Rng {
  const fallback = seededRng(1)
  let i = 0
  return { nextInt: (max) => (i < values.length ? values[i++]! : fallback.nextInt(max)) }
}

async function totalCards(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(sum(${userCards.quantity}), 0)::int` })
    .from(userCards)
    .where(eq(userCards.userId, userId))
  return row?.value ?? 0
}

async function setAnchor(db: Database, userId: string, anchor: Date): Promise<void> {
  await db
    .update(playerProfiles)
    .set({ freeBoosterAnchorAt: anchor })
    .where(eq(playerProfiles.userId, userId))
}

describe.skipIf(!testDatabaseUrl)('booster openings (integration)', () => {
  let db: Database
  let close: () => Promise<void>
  let ids: Record<string, number>

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => {
    await resetTestDatabase(db)
    await insertDiscordUser(db, { id: 'p1', name: 'Player', discordId: '200000000000000001' })
    await ensurePlayerProfile(db, { userId: 'p1', displayName: 'Player' })
    ;({ ids } = await insertSeriesWithCharacters(db, { slug: 'test-game', title: 'Test Game' }, [
      { name: 'Common A', rarity: 'common' },
      { name: 'Common B', rarity: 'common' },
      { name: 'Common C', rarity: 'common' },
      { name: 'Rare A', rarity: 'rare' },
      { name: 'Rare B', rarity: 'rare' },
      { name: 'Epic A', rarity: 'epic' },
      { name: 'Legendary A', rarity: 'legendary' },
      { name: 'Mythic A', rarity: 'mythic' },
    ]))
  })

  it('starts a new player with every free charge and lists the tiers', async () => {
    const boosters = await listBoosters(db, 'p1', NOW)
    expect(boosters.free).toMatchObject({ available: 15, max: 15, nextChargeAt: null })
    expect(boosters.gemBalance).toBe(0)
    expect(boosters.tiers.map((tier) => [tier.key, tier.priceGems])).toEqual([
      ['free', null],
      ['epic', 150],
      ['legendary', 500],
      ['mythic', 1500],
      ['divine', 5000],
    ])
  })

  it('opens a booster: 5 cards, one charge consumed, inventory and history updated', async () => {
    const result = await openBoosters(db, 'p1', { tier: 'free', quantity: 1 }, { now: NOW })

    expect(result.cards).toHaveLength(5)
    expect(result.free).toMatchObject({ available: 14, nextChargeAt: '2026-10-07T12:10:00.000Z' })
    expect(await totalCards(db, 'p1')).toBe(5)

    // Only the first occurrence of a character never owned before is new.
    const seen = new Set<number>()
    for (const card of result.cards) {
      expect(card.isNew).toBe(!seen.has(card.character.id))
      seen.add(card.character.id)
      expect(card.character.series).toMatchObject({ title: 'Test Game' })
    }

    const openings = await db.select().from(boosterOpenings)
    expect(openings).toEqual([expect.objectContaining({ userId: 'p1', quantity: 1, gemsSpent: 0 })])
    expect(await db.select().from(boosterOpeningCards)).toHaveLength(5)
  })

  it('draws the rarity from the rate table and records it', async () => {
    // r = 999 999 falls in the last bucket (mythic); then index 0 of the mythic pool.
    const rng = scriptedRng([999_999, 0])
    const result = await openBoosters(db, 'p1', { tier: 'free', quantity: 1 }, { now: NOW, rng })
    expect(result.cards[0]!.character).toMatchObject({ id: ids['Mythic A'], rarityKey: 'mythic' })
  })

  it('stacks duplicates and marks cards new only once across openings', async () => {
    const first = await openBoosters(
      db,
      'p1',
      { tier: 'free', quantity: 10 },
      { now: NOW, rng: seededRng(3) },
    )
    expect(first.cards).toHaveLength(50)
    const distinct = new Set(first.cards.map((card) => card.character.id))
    expect(first.cards.filter((card) => card.isNew)).toHaveLength(distinct.size)

    const second = await openBoosters(
      db,
      'p1',
      { tier: 'free', quantity: 5 },
      { now: NOW, rng: seededRng(4) },
    )
    for (const card of second.cards) {
      if (distinct.has(card.character.id)) expect(card.isNew).toBe(false)
    }
    expect(await totalCards(db, 'p1')).toBe(75)
    expect(second.free.available).toBe(0)
  })

  it('refuses to open more boosters than the available charges', async () => {
    await setAnchor(db, 'p1', new Date(NOW.getTime() - 2.5 * INTERVAL_MS))
    const attempt = openBoosters(db, 'p1', { tier: 'free', quantity: 5 }, { now: NOW })
    await expect(attempt).rejects.toMatchObject({
      code: 'NOT_ENOUGH_CHARGES',
      details: { available: 2 },
    })
    expect(await totalCards(db, 'p1')).toBe(0)
    expect((await getFreeBoosterStatus(db, 'p1', NOW)).available).toBe(2)
  })

  it('reads the timer from the settings', async () => {
    await db
      .update(settings)
      .set({ value: { intervalSeconds: 60, maxCharges: 3 } })
      .where(eq(settings.key, 'boosters.free'))
    const status = await getFreeBoosterStatus(db, 'p1', NOW)
    expect(status).toMatchObject({ available: 3, max: 3, intervalSeconds: 60 })
  })

  it('never exceeds the charges under concurrent openings', async () => {
    await setAnchor(db, 'p1', new Date(NOW.getTime() - 3 * INTERVAL_MS))
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        openBoosters(db, 'p1', { tier: 'free', quantity: 1 }, { now: NOW }),
      ),
    )
    const succeeded = attempts.filter((attempt) => attempt.status === 'fulfilled')
    const failed = attempts.filter((attempt) => attempt.status === 'rejected')
    expect(succeeded).toHaveLength(3)
    for (const attempt of failed) {
      expect(attempt.reason).toBeInstanceOf(AppError)
      expect((attempt.reason as AppError).code).toBe('NOT_ENOUGH_CHARGES')
    }
    expect(await totalCards(db, 'p1')).toBe(15)
    expect(await db.select().from(boosterOpenings)).toHaveLength(3)
  })

  it('never lets two concurrent x5 share the same charges', async () => {
    await setAnchor(db, 'p1', new Date(NOW.getTime() - 7 * INTERVAL_MS))
    const attempts = await Promise.allSettled([
      openBoosters(db, 'p1', { tier: 'free', quantity: 5 }, { now: NOW }),
      openBoosters(db, 'p1', { tier: 'free', quantity: 5 }, { now: NOW }),
    ])
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1)
    expect(await totalCards(db, 'p1')).toBe(25)
    expect((await getFreeBoosterStatus(db, 'p1', NOW)).available).toBe(2)
  })

  it('refuses unknown tiers and an empty pool', async () => {
    await expect(
      openBoosters(db, 'p1', { tier: 'nope', quantity: 1 }, { now: NOW }),
    ).rejects.toMatchObject({ code: 'BOOSTER_UNAVAILABLE' })

    await db.execute(sql`UPDATE characters SET is_active = false`)
    await expect(
      openBoosters(db, 'p1', { tier: 'free', quantity: 1 }, { now: NOW }),
    ).rejects.toMatchObject({ code: 'EMPTY_POOL' })
    expect((await getFreeBoosterStatus(db, 'p1', NOW)).available).toBe(15)
  })

  it('only draws drawable characters', async () => {
    await db.execute(sql`UPDATE characters SET is_active = false WHERE name_full <> 'Rare A'`)
    const result = await openBoosters(
      db,
      'p1',
      { tier: 'free', quantity: 10 },
      { now: NOW, rng: seededRng(9) },
    )
    // Every rarity falls back to the only drawable character.
    expect(new Set(result.cards.map((card) => card.character.id))).toEqual(new Set([ids['Rare A']]))
    expect(result.cards.every((card) => card.character.rarityKey === 'rare')).toBe(true)
  })

  describe('wishlist boost', () => {
    async function setBoost(boostPercent: number): Promise<void> {
      await db
        .update(settings)
        .set({ value: { maxItems: 20, boostPercent } })
        .where(eq(settings.key, 'wishlist'))
    }
    const open = () =>
      openBoosters(db, 'p1', { tier: 'free', quantity: 10 }, { now: NOW, rng: seededRng(3) })

    it('turns cards of a wished rarity into the wished character', async () => {
      await setBoost(100)
      await setWishlisted(db, 'p1', ids['Common B']!, true)

      const boosted = await open()
      const commons = boosted.cards.filter((card) => card.character.rarityKey === 'common')
      expect(commons.length).toBeGreaterThan(0)
      expect(commons.every((card) => card.character.id === ids['Common B'])).toBe(true)
      const rares = new Set(
        boosted.cards
          .filter((card) => card.character.rarityKey === 'rare')
          .map((card) => card.character.id),
      )
      expect(rares.size).toBeGreaterThan(1)
    })

    it('does not boost a wished character the player owns', async () => {
      await setBoost(100)
      await setWishlisted(db, 'p1', ids['Common B']!, true)
      await db.insert(userCards).values({
        userId: 'p1',
        characterId: ids['Common B']!,
        quantity: 1,
        firstObtainedAt: NOW,
        lastObtainedAt: NOW,
      })
      const result = await open()
      const commons = new Set(
        result.cards
          .filter((card) => card.character.rarityKey === 'common')
          .map((card) => card.character.id),
      )
      expect(commons.size).toBeGreaterThan(1)
    })
  })
})
