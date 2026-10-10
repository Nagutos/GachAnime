import { gemTransactions, playerProfiles, userCards, type Database } from '@gachanime/db'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { updateSetting } from '../admin/economy'
import { getFreeBoosterStatus, openBoosters } from '../boosters/boosters'
import { insertSeriesWithCharacters } from '../test/catalog-fixture'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import { adjustGems } from './gems'
import { ensurePlayerProfile } from './profile'
import { previewRecycleDuplicates, recycleCards } from './recycle'
import { buyUpgrade, listUpgrades } from './upgrades'
import { getWikiCharacter } from './wiki'

const NOW = new Date('2026-10-07T12:00:00Z')
const actor = { actorId: 'admin', ip: null }

describe.skipIf(!testDatabaseUrl)('upgrades (integration)', () => {
  let db: Database
  let close: () => Promise<void>
  let ids: Record<string, number>

  async function balance(): Promise<number> {
    const [row] = await db
      .select({ gemBalance: playerProfiles.gemBalance })
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, 'p1'))
    return row!.gemBalance
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
    ;({ ids } = await insertSeriesWithCharacters(db, { slug: 'up', title: 'Up' }, [
      { name: 'Common A', rarity: 'common' },
      { name: 'Legendary A', rarity: 'legendary' },
    ]))
  })

  it('lists every upgrade at level 0 with the default levels', async () => {
    const result = await listUpgrades(db, 'p1', NOW)
    expect(result.upgrades.map((upgrade) => upgrade.key)).toEqual([
      'booster_storage',
      'booster_speed',
      'recycle_bonus',
    ])
    expect(result.upgrades[0]).toMatchObject({
      level: 0,
      maxLevel: 5,
      value: null,
      next: { level: 1, cost: 1_000, value: 2 },
    })
    expect(result.free).toMatchObject({ available: 15, max: 15, intervalSeconds: 600 })
    expect(result.recycleMultiplier).toBe(1)
  })

  it('debits the gems, writes the ledger and refuses a stale or missing level', async () => {
    await adjustGems(db, { userId: 'p1', amount: 1_500, note: 'test' }, actor)
    const before = await balance()
    await expect(buyUpgrade(db, 'p1', 'booster_storage', { level: 2 }, NOW)).rejects.toMatchObject({
      code: 'UPGRADE_LEVEL_CHANGED',
      details: { level: 0 },
    })

    const result = await buyUpgrade(db, 'p1', 'booster_storage', { level: 1 }, NOW)
    expect(result.upgrades[0]).toMatchObject({ level: 1, value: 2 })
    expect(result.gemBalance).toBe(before - 1_000)
    const [row] = await db
      .select()
      .from(gemTransactions)
      .where(eq(gemTransactions.reason, 'upgrade_purchase'))
    expect(row).toMatchObject({ amount: -1_000, refType: 'upgrade', refId: 'booster_storage:1' })

    // Same click twice: the second one targets a level already bought.
    await expect(buyUpgrade(db, 'p1', 'booster_storage', { level: 1 }, NOW)).rejects.toMatchObject({
      code: 'UPGRADE_LEVEL_CHANGED',
    })
    await expect(buyUpgrade(db, 'p1', 'booster_storage', { level: 2 }, NOW)).rejects.toMatchObject({
      code: 'NOT_ENOUGH_GEMS',
    })
    expect(await balance()).toBe(before - 1_000)

    await updateSetting(db, 'upgrades.boosterStorage', { levels: [{ cost: 0, value: 2 }] }, actor)
    await expect(buyUpgrade(db, 'p1', 'booster_storage', { level: 2 }, NOW)).rejects.toMatchObject({
      code: 'UPGRADE_UNAVAILABLE',
    })
  })

  it('raises the cap and speeds up the free boosters without refilling them', async () => {
    await adjustGems(db, { userId: 'p1', amount: 10_000, note: 'test' }, actor)
    // Full (15 charges) since forever.
    const storage = await buyUpgrade(db, 'p1', 'booster_storage', { level: 1 }, NOW)
    expect(storage.free).toMatchObject({ available: 15, max: 17 })
    const speed = await buyUpgrade(db, 'p1', 'booster_speed', { level: 1 }, NOW)
    expect(speed.free).toMatchObject({ available: 15, max: 17, intervalSeconds: 570 })
    expect(speed.free.nextChargeAt).toBe(new Date(NOW.getTime() + 570_000).toISOString())

    const later = new Date(NOW.getTime() + 2 * 570_000)
    expect(await getFreeBoosterStatus(db, 'p1', later)).toMatchObject({ available: 17, max: 17 })
    const opened = await openBoosters(db, 'p1', { tier: 'free', quantity: 10 }, { now: later })
    expect(opened.free).toMatchObject({ available: 7, max: 17 })
  })

  it('multiplies recycle gems by the base rate and the upgrade', async () => {
    await db.insert(userCards).values([
      { userId: 'p1', characterId: ids['Common A']!, quantity: 5 },
      { userId: 'p1', characterId: ids['Legendary A']!, quantity: 3 },
    ])
    await updateSetting(db, 'recycle', { multiplier: 1.5 }, actor)
    await adjustGems(db, { userId: 'p1', amount: 800, note: 'test' }, actor)
    await buyUpgrade(db, 'p1', 'recycle_bonus', { level: 1 }, NOW)
    // Factor 1.5 × 1.1 = 1.65: common 2 → 3 (3.3), legendary 100 → 165.
    expect(await previewRecycleDuplicates(db, 'p1', {})).toMatchObject({
      cards: 6,
      gems: 4 * 3 + 2 * 165,
    })
    const entry = await getWikiCharacter(db, 'p1', ids['Legendary A']!)
    expect(entry).toMatchObject({ locked: false, recycleValue: 165 })
    const result = await recycleCards(db, 'p1', { characterId: ids['Common A']!, count: 2 })
    expect(result.gems).toBe(6)
    const [row] = await db
      .select({ quantity: userCards.quantity })
      .from(userCards)
      .where(and(eq(userCards.userId, 'p1'), eq(userCards.characterId, ids['Common A']!)))
    expect(row!.quantity).toBe(3)
  })
})
