import { settings, userCards, type Database } from '@gachanime/db'
import {
  collectionQuerySchema,
  type CollectionItem,
  type CollectionQueryInput,
} from '@gachanime/shared'
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
import { listWishlist, setWishlisted } from './wishlist'
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

    const query = (input: CollectionQueryInput = {}) => collectionQuerySchema.parse(input)
    const names = (items: CollectionItem[]) =>
      items.map((item) => (item.locked ? `?${item.name}` : item.name))

    it('lists owned cards with a summary, most recent first', async () => {
      const result = await listCollection(db, 'p1', query())
      expect(names(result.items)).toEqual(['Ben', 'Dana', 'Aiko'])
      expect(result.items[0]).toMatchObject({
        locked: false,
        quantity: 3,
        recyclable: 2,
        wishlisted: false,
        rarityKey: 'common',
        series: { id: alphaId, title: 'Alpha' },
      })
      expect(result.summary).toEqual({ owned: 3, cards: 6, catalog: 4 })
      expect(result.total).toBe(3)
    })

    it('filters and sorts, with multi-key sorts', async () => {
      const list = async (input: CollectionQueryInput) =>
        names((await listCollection(db, 'p1', query(input))).items)
      expect(await list({ sort: 'rarity:desc' })).toEqual(['Dana', 'Aiko', 'Ben'])
      expect(await list({ sort: 'count:desc' })).toEqual(['Ben', 'Dana', 'Aiko'])
      expect(await list({ sort: 'name:asc' })).toEqual(['Aiko', 'Ben', 'Dana'])
      expect(await list({ sort: 'series:asc,name:desc' })).toEqual(['Ben', 'Aiko', 'Dana'])
      expect(await list({ duplicates: 'true', sort: 'name' })).toEqual(['Ben', 'Dana'])
      expect(await list({ rarity: 'epic' })).toEqual(['Aiko'])
      expect(await list({ seriesId: String(betaId) })).toEqual(['Dana'])
      expect(await list({ search: 'ik' })).toEqual(['Aiko'])
    })

    it('lists missing characters as locked, and finds them by name', async () => {
      await db
        .update(userCards)
        .set({ quantity: 0 })
        .where(and(eq(userCards.userId, 'p1'), eq(userCards.characterId, ids['Ben']!)))
      const missing = await listCollection(db, 'p1', query({ ownership: 'missing', sort: 'name' }))
      // Ben is unlocked (no copy left), Chloe was never obtained.
      expect(names(missing.items)).toEqual(['Ben', '?Chloe'])
      expect(missing.items[0]).toMatchObject({ locked: false, quantity: 0 })
      const all = await listCollection(db, 'p1', query({ ownership: 'all', sort: 'rarity:desc' }))
      expect(names(all.items)).toEqual(['Dana', 'Aiko', '?Chloe', 'Ben'])
      const search = await listCollection(db, 'p1', query({ ownership: 'all', search: 'chlo' }))
      expect(names(search.items)).toEqual(['?Chloe'])
      expect(search.items[0]).toMatchObject({ series: { id: alphaId, title: 'Alpha' } })
      expect((await listCollection(db, 'p2', query())).total).toBe(0)
    })

    it('filters the wishlist, owned or not', async () => {
      await setWishlisted(db, 'p1', ids['Chloe']!, true)
      await setWishlisted(db, 'p1', ids['Dana']!, true)
      await setWishlisted(db, 'p1', ids['Dana']!, true)
      const wished = await listCollection(
        db,
        'p1',
        query({ ownership: 'all', wishlist: 'true', sort: 'rarity:desc' }),
      )
      expect(names(wished.items)).toEqual(['Dana', '?Chloe'])
      expect(wished.items.every((item) => item.wishlisted)).toBe(true)
      await setWishlisted(db, 'p1', ids['Dana']!, false)
      expect((await listCollection(db, 'p1', query({ wishlist: 'true' }))).total).toBe(0)
      // Undrawable characters never obtained cannot be wishlisted.
      await expect(setWishlisted(db, 'p1', ids['Retired']!, true)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })

    it('limits the wishlist and lists it newest first', async () => {
      await db
        .update(settings)
        .set({ value: { maxItems: 2, boostPercent: 5 } })
        .where(eq(settings.key, 'wishlist'))
      await setWishlisted(db, 'p1', ids['Chloe']!, true)
      await setWishlisted(db, 'p1', ids['Dana']!, true)
      await expect(setWishlisted(db, 'p1', ids['Ben']!, true)).rejects.toMatchObject({
        code: 'WISHLIST_FULL',
        details: { max: 2 },
      })
      // Already wished: not an addition, so a full list accepts it.
      await expect(setWishlisted(db, 'p1', ids['Dana']!, true)).resolves.toMatchObject({
        wishlisted: true,
      })

      const list = await listWishlist(db, 'p1')
      expect(list).toMatchObject({ maxItems: 2, boostPercent: 5 })
      expect(names(list.items)).toEqual(['Dana', '?Chloe'])
      expect(list.items[0]).toMatchObject({ locked: false, quantity: 2, wishlisted: true })

      await setWishlisted(db, 'p1', ids['Chloe']!, false)
      await setWishlisted(db, 'p1', ids['Ben']!, true)
      expect(names((await listWishlist(db, 'p1')).items)).toEqual(['Ben', 'Dana'])
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

      await give('Dana', 1)
      const status = async (value: 'complete' | 'incomplete' | 'started') =>
        (await listWikiSeries(db, 'p1', { ...page, sort: 'title', status: value })).items.map(
          (item) => item.title,
        )
      expect(await status('complete')).toEqual(['Beta'])
      expect(await status('incomplete')).toEqual(['Alpha'])
      expect(await status('started')).toEqual(['Alpha', 'Beta'])
    })

    it('shows locked entries of a series by name and picture only', async () => {
      await give('Chloe', 1)
      await setWishlisted(db, 'p1', ids['Ben']!, true)
      const result = await listWikiSeriesCharacters(db, 'p1', alphaId, page)
      // Sorted by rarity (highest first), then favourites.
      const card = (name: string, rarityKey: string) => ({
        id: ids[name],
        rarityKey,
        name,
        imageUrl: expect.any(String),
      })
      expect(result.items).toEqual([
        { ...card('Aiko', 'epic'), locked: true, wishlisted: false },
        { ...card('Chloe', 'rare'), locked: false, quantity: 1, wishlisted: false },
        { ...card('Ben', 'common'), locked: true, wishlisted: true },
      ])
      const lockedOnly = await listWikiSeriesCharacters(db, 'p1', alphaId, {
        ...page,
        unlocked: false,
      })
      expect(lockedOnly.total).toBe(2)
      expect(JSON.stringify(lockedOnly.items)).not.toContain('quantity')
    })

    it('gives the full entry only once unlocked, and keeps it unlocked', async () => {
      const locked = await getWikiCharacter(db, 'p1', ids['Aiko']!)
      expect(locked).toEqual({
        locked: true,
        id: ids['Aiko'],
        rarityKey: 'epic',
        series: [{ id: alphaId, title: 'Alpha' }],
        name: 'Aiko',
        imageUrl: expect.any(String),
        wishlisted: false,
      })

      await give('Aiko', 0)
      const unlocked = await getWikiCharacter(db, 'p1', ids['Aiko']!)
      expect(unlocked).toMatchObject({
        locked: false,
        name: 'Aiko',
        quantity: 0,
        recyclable: 0,
        recycleValue: 25,
        source: 'manual',
        sourceUrl: null,
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
