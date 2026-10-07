import type { MetricKeyName } from '@gachanime/shared'
import { z } from 'zod'
import type { GameEventType } from './events'

/**
 * Achievement metric registry (ADR-010, GAME_DESIGN §8). Admins create achievements from these
 * metrics without code changes; a new metric needs code. Counter metrics read `user_counters`;
 * state metrics are computed from the current inventory and catalog.
 */
export interface MetricDefinition {
  kind: 'counter' | 'state'
  params: z.ZodType<Record<string, unknown>>
  /** Events after which the metric may change. */
  listensTo: readonly GameEventType[]
}

const rarityParam = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/)
const noParams = z.object({}).strict()

export const METRICS = {
  boosters_opened: {
    kind: 'counter',
    params: z.object({ tier: z.string().min(1).max(64).optional() }).strict(),
    listensTo: ['booster_opened'],
  },
  cards_obtained: {
    kind: 'counter',
    params: z.object({ minRarity: rarityParam.optional() }).strict(),
    listensTo: ['card_obtained'],
  },
  cards_recycled: {
    kind: 'counter',
    params: z.object({ minRarity: rarityParam.optional() }).strict(),
    listensTo: ['card_recycled'],
  },
  cards_sold: { kind: 'counter', params: noParams, listensTo: ['card_sold'] },
  trades_completed: { kind: 'counter', params: noParams, listensTo: ['trade_completed'] },
  distinct_characters_owned: {
    kind: 'state',
    params: z.object({ rarity: rarityParam.optional() }).strict(),
    listensTo: ['card_obtained', 'card_sold', 'trade_completed'],
  },
  series_completed: {
    kind: 'state',
    params: noParams,
    listensTo: ['card_obtained', 'card_sold', 'trade_completed'],
  },
  /** Target is a percentage (0–100) of the active catalog owned. */
  catalog_completion: {
    kind: 'state',
    params: noParams,
    listensTo: ['card_obtained', 'card_sold', 'trade_completed'],
  },
} as const satisfies Record<MetricKeyName, MetricDefinition>

export type MetricKey = keyof typeof METRICS
export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[]

export function isMetricKey(value: string): value is MetricKey {
  return Object.hasOwn(METRICS, value)
}

/** Metrics that may change after these events. */
export function metricsAffectedBy(types: Iterable<GameEventType>): Set<MetricKey> {
  const wanted = new Set(types)
  return new Set(
    METRIC_KEYS.filter((key) =>
      (METRICS[key].listensTo as readonly GameEventType[]).some((type) => wanted.has(type)),
    ),
  )
}

/**
 * Counter keys summed by a counter metric. `minRarity` sums the per-rarity counters of that
 * rarity and every higher one (`rarityOrder` lowest first).
 */
export function counterKeysFor(
  metric: MetricKey,
  params: Record<string, unknown>,
  rarityOrder: readonly string[],
): string[] {
  const atLeast = (minRarity: unknown) => {
    const index = typeof minRarity === 'string' ? rarityOrder.indexOf(minRarity) : 0
    return rarityOrder.slice(Math.max(index, 0))
  }
  switch (metric) {
    case 'boosters_opened':
      return [
        typeof params.tier === 'string' ? `boosters_opened:${params.tier}` : 'boosters_opened',
      ]
    case 'cards_obtained':
      return atLeast(params.minRarity).map((rarity) => `cards_obtained:${rarity}`)
    case 'cards_recycled':
      return atLeast(params.minRarity).map((rarity) => `cards_recycled:${rarity}`)
    case 'cards_sold':
    case 'trades_completed':
      return [metric]
    default:
      return []
  }
}
