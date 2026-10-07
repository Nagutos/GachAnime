import {
  achievements,
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_MISSIONS,
  missions,
  userCards,
  userCounters,
  userMissions,
  type Database,
} from '@gachanime/db'
import { isMetricKey, METRICS, seededRng, type Rng } from '@gachanime/game'
import { GAME_EVENT_TYPES, type ProgressionUpdate } from '@gachanime/shared'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createAchievement, createMission, updateAchievement } from '../admin/objectives'
import { openBoosters } from '../boosters/boosters'
import { ensurePlayerProfile } from '../players/profile'
import { recycleCards } from '../players/recycle'
import { setWishlisted } from '../players/wishlist'
import { recordWikiView } from '../players/wiki'
import { insertSeriesWithCharacters } from '../test/catalog-fixture'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import { emitEvents } from './engine'
import { getMyFeedback, submitFeedback } from './feedback'
import {
  claimAchievement,
  claimMission,
  getProgressionSummary,
  listAchievements,
  listMissions,
} from './objectives'
import { recomputeStateAchievementsForAll } from './recompute'

// Noon in Paris on two consecutive days (default reset: 00:00 Europe/Paris).
const DAY1 = new Date('2026-10-07T10:00:00Z')
const DAY2 = new Date('2026-10-08T10:00:00Z')
const actor = { actorId: 'admin', ip: null }

/** Scripted values first, then a seeded generator. */
function scriptedRng(values: number[]): Rng {
  const fallback = seededRng(3)
  let i = 0
  return { nextInt: (max) => (i < values.length ? values[i++]! : fallback.nextInt(max)) }
}

describe('seeded objectives', () => {
  it.each(DEFAULT_MISSIONS.map((mission) => [mission.key, mission] as const))(
    'mission %s listens to a known event',
    (_key, mission) => {
      expect(GAME_EVENT_TYPES as readonly string[]).toContain(mission.eventType)
      expect(mission.target).toBeGreaterThan(0)
    },
  )

  it.each(DEFAULT_ACHIEVEMENTS.map((achievement) => [achievement.key, achievement] as const))(
    'achievement %s uses a known metric with valid params',
    (_key, achievement) => {
      expect(isMetricKey(achievement.metric)).toBe(true)
      if (isMetricKey(achievement.metric)) {
        expect(METRICS[achievement.metric].params.safeParse(achievement.params ?? {}).success).toBe(
          true,
        )
      }
    },
  )
})

describe.skipIf(!testDatabaseUrl)('progression (integration)', () => {
  let db: Database
  let close: () => Promise<void>
  let ids: Record<string, number>

  const missionId = async (key: string) =>
    (await db.query.missions.findFirst({ where: eq(missions.key, key) }))!.id
  const achievementId = async (key: string) =>
    (await db.query.achievements.findFirst({ where: eq(achievements.key, key) }))!.id
  const completedKeys = (update: ProgressionUpdate) => update.completed.map((item) => item.name.en)

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => {
    await resetTestDatabase(db)
    await insertDiscordUser(db, { id: 'admin', name: 'Admin', discordId: '400000000000000001' })
    await insertDiscordUser(db, { id: 'p1', name: 'Player', discordId: '400000000000000002' })
    await ensurePlayerProfile(db, { userId: 'p1', displayName: 'Player' })
    ;({ ids } = await insertSeriesWithCharacters(db, { slug: 'prog', title: 'Prog' }, [
      { name: 'Common A', rarity: 'common' },
      { name: 'Rare A', rarity: 'rare' },
      { name: 'Epic A', rarity: 'epic' },
    ]))
  })

  describe('missions', () => {
    it('completes the welcome mission at sign-up, claimable once', async () => {
      const list = await listMissions(db, 'p1', DAY1)
      expect(list.once).toEqual([
        expect.objectContaining({ key: 'welcome', completed: true, claimed: false, progress: 1 }),
      ])
      expect(list.daily.map((mission) => mission.key)).toEqual([
        'daily_open_booster',
        'daily_recycle',
        'daily_wishlist',
        'daily_wiki',
      ])
      expect(list).toMatchObject({
        periodKey: '2026-10-07',
        nextResetAt: '2026-10-07T22:00:00.000Z',
      })

      const id = await missionId('welcome')
      expect(await claimMission(db, 'p1', { missionId: id, periodKey: 'once' }, DAY1)).toEqual({
        rewardGems: 30,
        gemBalance: 30,
      })
      await expect(
        claimMission(db, 'p1', { missionId: id, periodKey: 'once' }, DAY1),
      ).rejects.toMatchObject({ code: 'NOT_CLAIMABLE' })
      expect((await listMissions(db, 'p1', DAY1)).once).toEqual([])
    })

    it('tracks daily missions per period, past days staying claimable', async () => {
      const result = await openBoosters(db, 'p1', { tier: 'free', quantity: 1 }, { now: DAY1 })
      expect(completedKeys(result.progression)).toContain('Open your first booster')

      const day2 = await listMissions(db, 'p1', DAY2)
      expect(day2.daily.find((mission) => mission.key === 'daily_open_booster')).toMatchObject({
        completed: false,
        progress: 0,
        periodKey: '2026-10-08',
      })
      const id = await missionId('daily_open_booster')
      await expect(
        claimMission(db, 'p1', { missionId: id, periodKey: '2026-10-08' }, DAY2),
      ).rejects.toMatchObject({ code: 'NOT_CLAIMABLE' })
      expect(
        await claimMission(db, 'p1', { missionId: id, periodKey: '2026-10-07' }, DAY2),
      ).toMatchObject({ rewardGems: 20 })
    })

    it('counts a wishlisted character once per day', async () => {
      await setWishlisted(db, 'p1', ids['Common A']!, true)
      await setWishlisted(db, 'p1', ids['Common A']!, false)
      await setWishlisted(db, 'p1', ids['Common A']!, true)
      const progress = async () =>
        (await listMissions(db, 'p1')).daily.find((mission) => mission.key === 'daily_wishlist')!
      expect(await progress()).toMatchObject({ progress: 1, completed: false })
      await setWishlisted(db, 'p1', ids['Rare A']!, true)
      const third = await setWishlisted(db, 'p1', ids['Epic A']!, true)
      expect(completedKeys(third.progression)).toEqual(['Add 3 characters to your wishlist'])
      expect(await progress()).toMatchObject({ progress: 3, completed: true })
    })

    it('completes the recycle and wiki missions', async () => {
      await db.insert(userCards).values({ userId: 'p1', characterId: ids['Rare A']!, quantity: 2 })
      const recycled = await recycleCards(db, 'p1', { characterId: ids['Rare A']!, count: 1 })
      expect(completedKeys(recycled.progression)).toEqual(['Recycle a duplicate'])
      const viewed = await recordWikiView(db, 'p1', ids['Rare A']!)
      expect(completedKeys(viewed)).toEqual(['Open a wiki entry'])
    })

    it('matches mission filters and refuses duplicate keys', async () => {
      await createMission(
        db,
        {
          key: 'daily_divine',
          name: { en: 'Open a Divine booster' },
          kind: 'daily',
          eventType: 'booster_opened',
          filter: { tier: 'divine' },
          target: 1,
          rewardGems: 50,
          isActive: true,
          sortOrder: 9,
        },
        actor,
      )
      const free = await emitEvents(db, 'p1', [
        { type: 'booster_opened', tier: 'free', quantity: 1 },
      ])
      expect(completedKeys(free)).not.toContain('Open a Divine booster')
      const divine = await emitEvents(db, 'p1', [
        { type: 'booster_opened', tier: 'divine', quantity: 1 },
      ])
      expect(completedKeys(divine)).toContain('Open a Divine booster')
      await expect(
        createMission(
          db,
          {
            key: 'daily_divine',
            name: { en: 'Again' },
            kind: 'daily',
            eventType: 'booster_opened',
            target: 1,
            rewardGems: 1,
            isActive: true,
            sortOrder: 0,
          },
          actor,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })
  })

  describe('achievements', () => {
    it('counts boosters and rarities obtained', async () => {
      // First card: r = 999 999 is the last bucket of the free rates (mythic), which falls back
      // to the best existing rarity, Epic.
      const result = await openBoosters(
        db,
        'p1',
        { tier: 'free', quantity: 10 },
        { now: DAY1, rng: scriptedRng([999_999, 0]) },
      )
      expect(completedKeys(result.progression)).toEqual(
        expect.arrayContaining(['First Steps', 'Epic!']),
      )
      const counters = await db.select().from(userCounters).where(eq(userCounters.userId, 'p1'))
      const counter = (key: string) => counters.find((row) => row.key === key)?.value
      expect(counter('boosters_opened')).toBe(10)
      expect(counter('boosters_opened:free')).toBe(10)
      expect(
        counters
          .filter((row) => row.key.startsWith('cards_obtained:'))
          .reduce((sum, row) => sum + row.value, 0),
      ).toBe(50)
    })

    it('completes state achievements, sticky even when cards are lost', async () => {
      await db
        .insert(userCards)
        .values(
          Object.values(ids).map((characterId) => ({ userId: 'p1', characterId, quantity: 1 })),
        )
      const update = await emitEvents(db, 'p1', [
        { type: 'card_obtained', rarity: 'common', count: 1, newCount: 1 },
      ])
      expect(completedKeys(update)).toEqual(
        expect.arrayContaining([
          'First Album',
          'Explorer',
          'Globetrotter',
          'Half the World',
          'Almost Everything',
        ]),
      )

      await db.update(userCards).set({ quantity: 0 }).where(eq(userCards.userId, 'p1'))
      const list = await listAchievements(db, 'p1', 'completed')
      expect(list.items.map((item) => item.key)).toEqual(
        expect.arrayContaining(['complete_1_series', 'catalog_75']),
      )
      expect(list.items.every((item) => item.progress === item.target)).toBe(true)

      const summary = await getProgressionSummary(db, 'p1')
      expect(summary.claimableAchievements).toBe(list.completed)
      const claimed = await claimAchievement(db, 'p1', await achievementId('catalog_75'))
      expect(claimed.rewardGems).toBe(6000)
      await expect(
        claimAchievement(db, 'p1', await achievementId('catalog_75')),
      ).rejects.toMatchObject({ code: 'NOT_CLAIMABLE' })
    })

    it('shows progress to do, and validates admin-created achievements', async () => {
      const { id } = await createAchievement(
        db,
        {
          key: 'own_2',
          name: { en: 'Pair' },
          metric: 'distinct_characters_owned',
          params: {},
          target: 2,
          rewardGems: 5,
          iconToken: 'star',
          isActive: true,
          sortOrder: 0,
        },
        actor,
      )
      await db.insert(userCards).values({ userId: 'p1', characterId: ids['Rare A']!, quantity: 3 })
      const todo = await listAchievements(db, 'p1', 'todo')
      expect(todo.items.find((item) => item.id === id)).toMatchObject({
        progress: 1,
        completedAt: null,
      })
      await expect(
        createAchievement(
          db,
          {
            key: 'bad',
            name: { en: 'Bad' },
            metric: 'cards_obtained',
            params: { minRarity: 'epic', extra: true },
            target: 1,
            rewardGems: 0,
            iconToken: 'star',
            isActive: true,
            sortOrder: 0,
          },
          actor,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
      await expect(
        updateAchievement(db, id, { params: { rarity: 'NOT A KEY' } }, actor),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })

    it('recomputes state achievements for everyone after a catalog change', async () => {
      // The player owns 2 of the 3 characters: the series is not complete.
      await db.insert(userCards).values([
        { userId: 'p1', characterId: ids['Common A']!, quantity: 1 },
        { userId: 'p1', characterId: ids['Rare A']!, quantity: 1 },
      ])
      await listAchievements(db, 'p1', 'all')
      await db.execute(sql`UPDATE characters SET is_active = false WHERE id = ${ids['Epic A']!}`)

      const result = await recomputeStateAchievementsForAll(db)
      expect(result.players).toBe(1)
      const done = await listAchievements(db, 'p1', 'completed')
      expect(done.items.map((item) => item.key)).toContain('complete_1_series')
    })
  })

  describe('feedback', () => {
    it('emits feedback_submitted on the first submission only', async () => {
      const first = await submitFeedback(db, 'p1', { rating: 4, comment: 'Nice' })
      expect(completedKeys(first.progression)).toEqual(['Critic'])
      const edit = await submitFeedback(db, 'p1', { rating: 5, comment: null })
      expect(edit.progression.completed).toEqual([])
      expect((await getMyFeedback(db, 'p1')).feedback).toMatchObject({ rating: 5, comment: null })
      const [counter] = await db
        .select()
        .from(userCounters)
        .where(and(eq(userCounters.userId, 'p1'), eq(userCounters.key, 'feedback_submitted')))
      expect(counter?.value).toBe(1)
    })
  })

  it('never completes a mission twice in one period', async () => {
    await openBoosters(db, 'p1', { tier: 'free', quantity: 1 }, { now: DAY1 })
    const again = await openBoosters(db, 'p1', { tier: 'free', quantity: 1 }, { now: DAY1 })
    expect(completedKeys(again.progression)).not.toContain('Open your first booster')
    const rows = await db.select().from(userMissions).where(eq(userMissions.userId, 'p1'))
    expect(rows.filter((row) => row.periodKey === '2026-10-07')).toHaveLength(1)
  })
})
