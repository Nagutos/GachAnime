import { RATE_TOTAL, rateWeightsIssues, type RateWeights } from './rates'
import type { Rng } from './rng'

/** One drawn card: its rarity and an index into that rarity's pool. */
export interface DrawnCard<K extends string = string> {
  rarityKey: K
  /** Uniform index in `[0, poolSize(rarityKey))`. */
  index: number
}

/** Walks the cumulative weights (in rarity order) with `r ∈ [0, RATE_TOTAL)`. */
export function drawRarity<K extends string>(
  rarityOrder: readonly K[],
  weights: RateWeights,
  rng: Rng,
): K {
  const r = rng.nextInt(RATE_TOTAL)
  let cumulative = 0
  for (const key of rarityOrder) {
    cumulative += weights[key] ?? 0
    if (r < cumulative) return key
  }
  throw new Error('Rate weights do not cover the draw: check that they sum to RATE_TOTAL')
}

/**
 * Rarity actually used when the drawn one has no character in the pool: the next lower rarity,
 * then the next higher one (GAME_DESIGN §2). Returns null when the whole pool is empty.
 */
export function fallbackRarity<K extends string>(
  rarityOrder: readonly K[],
  drawn: K,
  poolSize: (key: K) => number,
): K | null {
  const start = rarityOrder.indexOf(drawn)
  if (start === -1) throw new Error(`Unknown rarity "${drawn}"`)
  for (let i = start; i >= 0; i--) {
    const key = rarityOrder[i]!
    if (poolSize(key) > 0) return key
  }
  for (let i = start + 1; i < rarityOrder.length; i++) {
    const key = rarityOrder[i]!
    if (poolSize(key) > 0) return key
  }
  return null
}

export interface DrawCardsInput<K extends string> {
  /** Rarity keys from lowest to highest. */
  rarityOrder: readonly K[]
  weights: RateWeights
  /** Number of drawable characters per rarity. */
  poolSizes: Partial<Record<K, number>>
  count: number
  rng: Rng
}

/**
 * Draws `count` independent cards: a rarity from the weights (with empty-rarity fallback), then a
 * uniform character of that rarity. No pity, no guaranteed slot (decided).
 */
export function drawCards<K extends string>(input: DrawCardsInput<K>): DrawnCard<K>[] {
  const issues = rateWeightsIssues(input.weights)
  if (issues.length > 0) throw new Error(`Invalid rate table: ${issues.join('; ')}`)
  const poolSize = (key: K) => input.poolSizes[key] ?? 0

  const cards: DrawnCard<K>[] = []
  for (let i = 0; i < input.count; i++) {
    const drawn = drawRarity(input.rarityOrder, input.weights, input.rng)
    const rarityKey = fallbackRarity(input.rarityOrder, drawn, poolSize)
    if (rarityKey === null) throw new Error('The booster pool is empty')
    cards.push({ rarityKey, index: input.rng.nextInt(poolSize(rarityKey)) })
  }
  return cards
}
