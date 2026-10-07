import { characters, rarities, userCards, userCounters, type Executor } from '@gachanime/db'
import { counterKeysFor, isMetricKey, METRICS, type MetricKey } from '@gachanime/game'
import { and, eq, gt, sql } from 'drizzle-orm'
import { loadRarities } from '../catalog/rarities'

export interface AchievementMetric {
  id: number
  metric: string
  params: Record<string, unknown>
}

/**
 * Current value of each achievement's metric for one player. Counter metrics sum lifetime
 * counters; state metrics are computed from the inventory (GAME_DESIGN §8: owned characters
 * include deactivated ones; series and catalog completion only consider active ones).
 */
export async function computeMetricValues(
  db: Executor,
  userId: string,
  list: AchievementMetric[],
): Promise<Map<number, number>> {
  const values = new Map<number, number>()
  const needed = new Set(list.map((item) => item.metric).filter(isMetricKey))
  const needsCounters = [...needed].some((metric) => METRICS[metric].kind === 'counter')

  const [rarityRows, counters] = await Promise.all([
    loadRarities(db),
    needsCounters
      ? db
          .select({ key: userCounters.key, value: userCounters.value })
          .from(userCounters)
          .where(eq(userCounters.userId, userId))
      : Promise.resolve([]),
  ])
  const counterMap = new Map(counters.map((row) => [row.key, row.value]))
  const rarityOrder = rarityRows.map((rarity) => rarity.key)

  const cache = new Map<string, Promise<number>>()
  const state = (key: string, compute: () => Promise<number>) => {
    if (!cache.has(key)) cache.set(key, compute())
    return cache.get(key)!
  }

  for (const item of list) {
    if (!isMetricKey(item.metric)) continue
    const metric: MetricKey = item.metric
    if (METRICS[metric].kind === 'counter') {
      const keys = counterKeysFor(metric, item.params, rarityOrder)
      values.set(
        item.id,
        keys.reduce((sum, key) => sum + (counterMap.get(key) ?? 0), 0),
      )
      continue
    }
    if (metric === 'distinct_characters_owned') {
      const rarity = typeof item.params.rarity === 'string' ? item.params.rarity : null
      values.set(
        item.id,
        await state(`owned:${rarity ?? '*'}`, () => distinctOwned(db, userId, rarity)),
      )
    } else if (metric === 'series_completed') {
      values.set(item.id, await state('series', () => seriesCompleted(db, userId)))
    } else if (metric === 'catalog_completion') {
      values.set(item.id, await state('catalog', () => catalogCompletion(db, userId)))
    }
  }
  return values
}

async function distinctOwned(db: Executor, userId: string, rarity: string | null): Promise<number> {
  const conditions = [eq(userCards.userId, userId), gt(userCards.quantity, 0)]
  if (rarity) conditions.push(eq(rarities.key, rarity))
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(userCards)
    .innerJoin(characters, eq(characters.id, userCards.characterId))
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
    .where(and(...conditions))
  return row?.value ?? 0
}

/** Active series whose active characters are all owned. */
async function seriesCompleted(db: Executor, userId: string): Promise<number> {
  const result = await db.execute<{ value: number }>(sql`
    SELECT count(*)::int AS value FROM series s
    WHERE s.is_active
      AND EXISTS (SELECT 1 FROM series_characters sc JOIN characters c ON c.id = sc.character_id
        WHERE sc.series_id = s.id AND c.is_active)
      AND NOT EXISTS (
        SELECT 1 FROM series_characters sc JOIN characters c ON c.id = sc.character_id
        WHERE sc.series_id = s.id AND c.is_active
          AND NOT EXISTS (SELECT 1 FROM user_cards uc
            WHERE uc.user_id = ${userId} AND uc.character_id = c.id AND uc.quantity > 0))`)
  return Number(result.rows[0]?.value ?? 0)
}

/** Whole percentage (rounded down) of drawable characters owned. */
async function catalogCompletion(db: Executor, userId: string): Promise<number> {
  const result = await db.execute<{ owned: number; total: number }>(sql`
    SELECT count(uc.character_id)::int AS owned, count(*)::int AS total
    FROM drawable_characters d
    LEFT JOIN user_cards uc
      ON uc.character_id = d.character_id AND uc.user_id = ${userId} AND uc.quantity > 0`)
  const row = result.rows[0]
  const total = Number(row?.total ?? 0)
  return total === 0 ? 0 : Math.floor((Number(row?.owned ?? 0) * 100) / total)
}
