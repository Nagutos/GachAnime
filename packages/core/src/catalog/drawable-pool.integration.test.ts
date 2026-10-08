import { characters, series, themeCharacters, themes, type Database } from '@gachanime/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { insertSeriesWithCharacters } from '../test/catalog-fixture'
import { resetTestDatabase, setupTestDatabase, testDatabaseUrl } from '../test/database'
import {
  getCatalogVersion,
  loadDrawableIds,
  loadDrawablePool,
  loadThemePoolSizes,
} from './drawable-pool'
import { RarityTable } from './rarities'

describe.skipIf(!testDatabaseUrl)('drawable pool cache (integration)', () => {
  let db: Database
  let close: () => Promise<void>

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => resetTestDatabase(db))

  const sorted = (pool: ReadonlyMap<number, readonly number[]>) =>
    [...pool.values()].flat().sort((a, b) => a - b)

  it('follows every catalog change that affects drawability', async () => {
    const { seriesId, ids } = await insertSeriesWithCharacters(db, { slug: 'one', title: 'One' }, [
      { name: 'A', rarity: 'common' },
      { name: 'B', rarity: 'rare' },
      { name: 'C', rarity: 'common' },
    ])
    expect(sorted(await loadDrawablePool(db, null))).toEqual([ids.A, ids.B, ids.C])

    const before = await getCatalogVersion(db)
    await db.update(characters).set({ isActive: false }).where(eq(characters.id, ids.B!))
    expect(await getCatalogVersion(db)).not.toBe(before)
    expect(sorted(await loadDrawablePool(db, null))).toEqual([ids.A, ids.C])
    expect((await loadDrawableIds(db)).has(ids.B!)).toBe(false)

    const common = (await RarityTable.load(db)).idForKey('common')
    const rare = (await RarityTable.load(db)).idForKey('rare')
    await db.update(characters).set({ rarityId: rare }).where(eq(characters.id, ids.C!))
    const pool = await loadDrawablePool(db, null)
    expect(pool.get(common)).toEqual([ids.A])
    expect(pool.get(rare)).toEqual([ids.C])

    await db.update(series).set({ isActive: false }).where(eq(series.id, seriesId))
    expect(await loadDrawablePool(db, null)).toEqual(new Map())
    expect((await loadDrawableIds(db)).size).toBe(0)
  })

  it('does not change the version for unrelated updates', async () => {
    const { ids } = await insertSeriesWithCharacters(db, { slug: 'one', title: 'One' }, [
      { name: 'A', rarity: 'common' },
    ])
    const before = await getCatalogVersion(db)
    await db.update(characters).set({ imagePath: 'cache/x.webp' }).where(eq(characters.id, ids.A!))
    expect(await getCatalogVersion(db)).toBe(before)
  })

  it('tracks pack pools', async () => {
    const { ids } = await insertSeriesWithCharacters(db, { slug: 'one', title: 'One' }, [
      { name: 'A', rarity: 'common' },
      { name: 'B', rarity: 'common' },
    ])
    const [theme] = await db.select().from(themes).limit(1)
    await db.delete(themeCharacters).where(eq(themeCharacters.themeId, theme!.id))
    expect(sorted(await loadDrawablePool(db, theme!.id))).toEqual([])
    expect((await loadThemePoolSizes(db)).get(theme!.id)).toBeUndefined()

    await db.insert(themeCharacters).values({ themeId: theme!.id, characterId: ids.A! })
    expect(sorted(await loadDrawablePool(db, theme!.id))).toEqual([ids.A])
    expect((await loadThemePoolSizes(db)).get(theme!.id)).toBe(1)
  })

  it('never serves a pool cached for another database state after a reset', async () => {
    await insertSeriesWithCharacters(db, { slug: 'one', title: 'One' }, [
      { name: 'A', rarity: 'common' },
    ])
    expect((await loadDrawableIds(db)).size).toBe(1)
    await resetTestDatabase(db)
    expect((await loadDrawableIds(db)).size).toBe(0)
  })
})
