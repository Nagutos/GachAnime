import { userCards, type Database } from '@gachanime/db'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { insertSeriesWithCharacters } from '../test/catalog-fixture'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import { listCollection } from './collection'
import { ensurePlayerProfile } from './profile'
import { getWikiCharacter, getWikiSeries, listWikiSeries, listWikiSeriesCharacters } from './wiki'

const page = { page: 1, pageSize: 50 }

describe.skipIf(!testDatabaseUrl)('collection and wiki (integration)', () => {
  let db: Database
  let close: () => Promise<void>
  let ids: Record<string, number>
  let alphaId: number
  let betaId: number

  async function give(name: string, quantity: number, obtainedAt = new Date()): Promise<void> {
    await db.insert(userCards).values({
      userId: 'p1',
      characterId: ids[name]!,
      quantity,
      firstObtainedAt: obtainedAt,
      lastObtainedAt: obtainedAt,
    })
  }

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => {
    await resetTestDatabase(db)
    await insertDiscordUser(db, { id: 'p1', name: 'Player', discordId: '200000000000000001' })
    await insertDiscordUser(db, { id: 'p2', name: 'Other', discordId: '200000000000000002' })
    await ensurePlayerProfile(db, { userId: 'p1', displayName: 'Player' })
    await ensurePlayerProfile(db, { userId: 'p2', displayName: 'Other' })
    const alpha = await insertSeriesWithCharacters(
      db,
      { slug: 'alpha', title: 'Alpha', popularity: 100 },
      [
        { name: 'Aiko', rarity: 'epic', favourites: 5000 },
        { name: 'Ben', rarity: 'common', favourites: 10 },
        { name: 'Chloe', rarity: 'rare', favourites: 900 },
        { name: 'Retired', rarity: 'rare', isActive: false },
      ],
    )
    const beta = await insertSeriesWithCharacters(
      db,
      { slug: 'beta', title: 'Beta', popularity: 50 },
      [{ name: 'Dana', rarity: 'mythic' }],
    )
    await insertSeriesWithCharacters(db, { slug: 'hidden', title: 'Hidden', isActive: false }, [
      { name: 'Ghost', rarity: 'common' },
    ])
    ids = { ...alpha.ids, ...beta.ids }
    alphaId = alpha.seriesId
    betaId = beta.seriesId
  })

  describe('collection', () => {
    beforeEach(async () => {
      await give('Aiko', 1, new Date('2026-10-01T00:00:00Z'))
      await give('Ben', 3, new Date('2026-10-03T00:00:00Z'))
      await give('Dana', 2, new Date('2026-10-02T00:00:00Z'))
    })

    it('lists owned cards with a summary, most recent first', async () => {
      const result = await listCollection(db, 'p1', { ...page, sort: 'recent' })
      expect(result.items.map((item) => item.name)).toEqual(['Ben', 'Dana', 'Aiko'])
      expect(result.items[0]).toMatchObject({
        quantity: 3,
        rarityKey: 'common',
        series: { id: alphaId, title: 'Alpha' },
      })
      expect(result.summary).toEqual({ owned: 3, cards: 6, catalog: 4 })
      expect(result.total).toBe(3)
    })

    it('filters and sorts', async () => {
      const names = async (query: Partial<Parameters<typeof listCollection>[2]>) =>
        (await listCollection(db, 'p1', { ...page, sort: 'recent', ...query })).items.map(
          (item) => item.name,
        )
      expect(await names({ sort: 'rarity' })).toEqual(['Dana', 'Aiko', 'Ben'])
      expect(await names({ sort: 'count' })).toEqual(['Ben', 'Dana', 'Aiko'])
      expect(await names({ sort: 'name' })).toEqual(['Aiko', 'Ben', 'Dana'])
      expect(await names({ duplicates: true, sort: 'name' })).toEqual(['Ben', 'Dana'])
      expect(await names({ rarity: 'epic' })).toEqual(['Aiko'])
      expect(await names({ seriesId: betaId })).toEqual(['Dana'])
      expect(await names({ search: 'ik' })).toEqual(['Aiko'])
    })

    it('hides cards no longer owned and other players cards', async () => {
      await db
        .update(userCards)
        .set({ quantity: 0 })
        .where(and(eq(userCards.userId, 'p1'), eq(userCards.characterId, ids['Ben']!)))
      const result = await listCollection(db, 'p1', { ...page, sort: 'name' })
      expect(result.items.map((item) => item.name)).toEqual(['Aiko', 'Dana'])
      expect((await listCollection(db, 'p2', { ...page, sort: 'name' })).total).toBe(0)
    })
  })

  describe('wiki', () => {
    it('lists active series with the player progress', async () => {
      await give('Aiko', 2)
      await give('Ben', 0) // obtained once, then traded away: unlocked but not owned
      const result = await listWikiSeries(db, 'p1', { ...page, sort: 'popularity' })
      expect(result.items.map((item) => [item.title, item.characterCount])).toEqual([
        ['Alpha', 3],
        ['Beta', 1],
      ])
      expect(result.items[0]).toMatchObject({ unlockedCount: 2, ownedCount: 1 })

      const byProgress = await listWikiSeries(db, 'p1', { ...page, sort: 'progress' })
      expect(byProgress.items.map((item) => item.title)).toEqual(['Alpha', 'Beta'])
      const searched = await listWikiSeries(db, 'p1', { ...page, sort: 'title', search: 'bet' })
      expect(searched.items.map((item) => item.title)).toEqual(['Beta'])
    })

    it('masks locked entries of a series', async () => {
      await give('Chloe', 1)
      const result = await listWikiSeriesCharacters(db, 'p1', alphaId, page)
      // Sorted by rarity (highest first), then favourites.
      expect(result.items).toEqual([
        { locked: true, id: ids['Aiko'], rarityKey: 'epic' },
        {
          locked: false,
          id: ids['Chloe'],
          rarityKey: 'rare',
          name: 'Chloe',
          imageUrl: expect.any(String),
          quantity: 1,
        },
        { locked: true, id: ids['Ben'], rarityKey: 'common' },
      ])
      const lockedOnly = await listWikiSeriesCharacters(db, 'p1', alphaId, {
        ...page,
        unlocked: false,
      })
      expect(lockedOnly.total).toBe(2)
      expect(JSON.stringify(lockedOnly.items)).not.toContain('Aiko')
    })

    it('gives the full entry only once unlocked, and keeps it unlocked', async () => {
      const locked = await getWikiCharacter(db, 'p1', ids['Aiko']!)
      expect(locked).toEqual({
        locked: true,
        id: ids['Aiko'],
        rarityKey: 'epic',
        series: [{ id: alphaId, title: 'Alpha' }],
      })

      await give('Aiko', 0)
      const unlocked = await getWikiCharacter(db, 'p1', ids['Aiko']!)
      expect(unlocked).toMatchObject({
        locked: false,
        name: 'Aiko',
        quantity: 0,
        source: 'manual',
        anilistUrl: null,
      })
    })

    it('hides undrawable characters unless the player unlocked them', async () => {
      await expect(getWikiCharacter(db, 'p1', ids['Retired']!)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      await db.insert(userCards).values({ userId: 'p1', characterId: ids['Retired']!, quantity: 1 })
      expect(await getWikiCharacter(db, 'p1', ids['Retired']!)).toMatchObject({
        locked: false,
        name: 'Retired',
      })
    })

    it('refuses inactive series', async () => {
      await db.execute(sql`UPDATE series SET is_active = false WHERE slug = 'beta'`)
      await expect(getWikiSeries(db, 'p1', betaId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(listWikiSeriesCharacters(db, 'p1', betaId, page)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      expect(await getWikiSeries(db, 'p1', alphaId)).toMatchObject({
        title: 'Alpha',
        characterCount: 3,
        source: 'manual',
        genres: [],
        siteUrl: null,
      })
    })
  })
})
