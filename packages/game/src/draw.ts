import { RATE_TOTAL, rateWeightsIssues, type RateWeights } from './rates'
import type { Rng } from './rng'

/** One drawn card: its rarity and an index into that rarity's pool (or its wished characters). */
export interface DrawnCard<K extends string = string> {
  rarityKey: K
  /** True when the wishlist boost picked the card: `index` is then into the wished characters. */
  wished: boolean
  /** Uniform index in `[0, poolSize(rarityKey))`, or `[0, wishedSize(rarityKey))` when wished. */
  index: number
}

/** Wishlist boost chances are expressed out of this total (0.01 % steps). */
export const WISH_CHANCE_TOTAL = 10_000

/** A boost percentage (`wishlist` setting) as a chance out of `WISH_CHANCE_TOTAL`. */
export function wishChance(boostPercent: number): number {
  return Math.round(Math.min(Math.max(boostPercent, 0), 100) * (WISH_CHANCE_TOTAL / 100))
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
  /**
   * Wishlist boost: number of the player's wished (not owned) characters per rarity in this pool,
   * and the chance (out of `WISH_CHANCE_TOTAL`) that a card of such a rarity is one of them.
   */
  wished?: Partial<Record<K, number>>
  wishChance?: number
}

/**
 * Draws `count` independent cards: a rarity from the weights (with empty-rarity fallback), then a
 * uniform character of that rarity. No pity, no guaranteed slot (decided). The wishlist boost never
 * changes the rarity: when the player wishes characters of the drawn rarity, the card is one of
 * them with `wishChance` (GAME_DESIGN §6). No extra random number is used without wished
 * characters, so seeded draws stay the same.
 */
export function drawCards<K extends string>(input: DrawCardsInput<K>): DrawnCard<K>[] {
  const issues = rateWeightsIssues(input.weights)
  if (issues.length > 0) throw new Error(`Invalid rate table: ${issues.join('; ')}`)
  const poolSize = (key: K) => input.poolSizes[key] ?? 0
  const chance = input.wishChance ?? 0

  const cards: DrawnCard<K>[] = []
  for (let i = 0; i < input.count; i++) {
    const drawn = drawRarity(input.rarityOrder, input.weights, input.rng)
    const rarityKey = fallbackRarity(input.rarityOrder, drawn, poolSize)
    if (rarityKey === null) throw new Error('The booster pool is empty')
    const wishedSize = input.wished?.[rarityKey] ?? 0
    if (chance > 0 && wishedSize > 0 && input.rng.nextInt(WISH_CHANCE_TOTAL) < chance) {
      cards.push({ rarityKey, wished: true, index: input.rng.nextInt(wishedSize) })
    } else {
      cards.push({ rarityKey, wished: false, index: input.rng.nextInt(poolSize(rarityKey)) })
    }
  }
  return cards
}
