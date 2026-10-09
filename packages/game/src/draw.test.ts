import { describe, expect, it } from 'vitest'
import { drawCards, drawRarity, fallbackRarity, wishChance, WISH_CHANCE_TOTAL } from './draw'
import { CARDS_PER_BOOSTER, RATE_TOTAL, weightsFromBoosterTargets } from './rates'
import { seededRng, type Rng } from './rng'

const ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const
type Key = (typeof ORDER)[number]

/** Free booster targets: chance of at least one card of the rarity per booster (GAME_DESIGN §2). */
const FREE_TARGETS = { rare: 0.941, epic: 0.176, legendary: 0.02, mythic: 0.0033 }
const FREE_WEIGHTS = weightsFromBoosterTargets(FREE_TARGETS, 'common')
const FULL_POOL: Record<Key, number> = {
  common: 1000,
  rare: 500,
  epic: 100,
  legendary: 30,
  mythic: 10,
}

/** Always returns the given values in order (then repeats the last one). */
function scriptedRng(values: number[]): Rng {
  let i = 0
  return { nextInt: () => values[Math.min(i++, values.length - 1)]! }
}

describe('drawRarity', () => {
  const weights = { common: 600_000, rare: 300_000, epic: 100_000, legendary: 0, mythic: 0 }

  it.each([
    [0, 'common'],
    [599_999, 'common'],
    [600_000, 'rare'],
    [899_999, 'rare'],
    [900_000, 'epic'],
    [999_999, 'epic'],
  ])('maps r = %i to %s', (r, expected) => {
    expect(drawRarity(ORDER, weights, scriptedRng([r]))).toBe(expected)
  })
})

describe('fallbackRarity', () => {
  const sizes = (pool: Partial<Record<Key, number>>) => (key: Key) => pool[key] ?? 0

  it('keeps the drawn rarity when it has characters', () => {
    expect(fallbackRarity(ORDER, 'epic', sizes({ epic: 1 }))).toBe('epic')
  })

  it('falls back to the next lower rarity first', () => {
    expect(fallbackRarity(ORDER, 'mythic', sizes({ common: 5, rare: 3 }))).toBe('rare')
  })

  it('then to the next higher rarity', () => {
    expect(fallbackRarity(ORDER, 'common', sizes({ epic: 2, mythic: 1 }))).toBe('epic')
  })

  it('returns null for an empty pool', () => {
    expect(fallbackRarity(ORDER, 'rare', sizes({}))).toBeNull()
  })
})

describe('drawCards', () => {
  it('draws the requested number of cards with indexes inside the pool', () => {
    const cards = drawCards({
      rarityOrder: ORDER,
      weights: FREE_WEIGHTS,
      poolSizes: FULL_POOL,
      count: 1000,
      rng: seededRng(1),
    })
    expect(cards).toHaveLength(1000)
    for (const card of cards) {
      expect(card.index).toBeGreaterThanOrEqual(0)
      expect(card.index).toBeLessThan(FULL_POOL[card.rarityKey])
    }
  })

  it('is deterministic for a given seed', () => {
    const draw = () =>
      drawCards({
        rarityOrder: ORDER,
        weights: FREE_WEIGHTS,
        poolSizes: FULL_POOL,
        count: 50,
        rng: seededRng(42),
      })
    expect(draw()).toEqual(draw())
  })

  it('applies the fallback when a rarity is empty', () => {
    const cards = drawCards({
      rarityOrder: ORDER,
      weights: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: RATE_TOTAL },
      poolSizes: { common: 3 },
      count: 10,
      rng: seededRng(7),
    })
    expect(cards.every((card) => card.rarityKey === 'common')).toBe(true)
  })

  it('refuses an invalid rate table or an empty pool', () => {
    const base = { rarityOrder: ORDER, poolSizes: FULL_POOL, count: 1, rng: seededRng(1) }
    expect(() => drawCards({ ...base, weights: { common: 10 } })).toThrow(/Invalid rate table/)
    expect(() => drawCards({ ...base, weights: FREE_WEIGHTS, poolSizes: {} })).toThrow(/empty/)
  })
})

describe('wishlist boost', () => {
  it('converts a boost percentage into a chance', () => {
    expect(wishChance(5)).toBe(500)
    expect(wishChance(0.25)).toBe(25)
    expect(wishChance(-1)).toBe(0)
    expect(wishChance(150)).toBe(WISH_CHANCE_TOTAL)
  })

  it('picks a wished character of the drawn rarity, below the chance only', () => {
    const base = {
      rarityOrder: ORDER,
      weights: { common: RATE_TOTAL, rare: 0, epic: 0, legendary: 0, mythic: 0 },
      poolSizes: FULL_POOL,
      count: 1,
      wished: { common: 3 },
      wishChance: 500,
    }
    // Rarity roll, wish roll (499 < 500), index among the 3 wished characters.
    expect(drawCards({ ...base, rng: scriptedRng([0, 499, 2]) })).toEqual([
      { rarityKey: 'common', wished: true, index: 2 },
    ])
    expect(drawCards({ ...base, rng: scriptedRng([0, 500, 7]) })).toEqual([
      { rarityKey: 'common', wished: false, index: 7 },
    ])
  })

  it('uses no extra random number without wished characters of that rarity', () => {
    const draw = (wished?: Partial<Record<Key, number>>) =>
      drawCards({
        rarityOrder: ORDER,
        weights: FREE_WEIGHTS,
        poolSizes: FULL_POOL,
        count: 50,
        rng: seededRng(42),
        wished,
        wishChance: 500,
      })
    expect(draw({ mythic: 0 })).toEqual(draw())
  })

  it('keeps the rarity rates and gives the boosted share (statistical)', () => {
    const trials = 200_000
    const cards = drawCards({
      rarityOrder: ORDER,
      weights: FREE_WEIGHTS,
      poolSizes: FULL_POOL,
      count: trials,
      rng: seededRng(9),
      wished: { common: 2, rare: 1 },
      wishChance: 500,
    })
    const commons = cards.filter((card) => card.rarityKey === 'common')
    const share = commons.length / trials
    const expectedShare = FREE_WEIGHTS.common! / RATE_TOTAL
    expect(Math.abs(share - expectedShare)).toBeLessThan(
      5 * Math.sqrt((expectedShare * (1 - expectedShare)) / trials),
    )
    const wished = commons.filter((card) => card.wished).length / commons.length
    expect(Math.abs(wished - 0.05)).toBeLessThan(5 * Math.sqrt((0.05 * 0.95) / commons.length))
    expect(cards.some((card) => card.wished && card.rarityKey === 'epic')).toBe(false)
  })
})

describe('free booster rates (statistical)', () => {
  const BOOSTERS = 200_000

  const cards = drawCards({
    rarityOrder: ORDER,
    weights: FREE_WEIGHTS,
    poolSizes: FULL_POOL,
    count: BOOSTERS * CARDS_PER_BOOSTER,
    rng: seededRng(20261007),
  })

  /** |observed − expected| must stay within 5 binomial standard deviations. */
  function expectWithinFiveSigma(observed: number, expected: number, trials: number): void {
    const sigma = Math.sqrt((expected * (1 - expected)) / trials)
    expect(Math.abs(observed - expected)).toBeLessThanOrEqual(5 * sigma)
  }

  it.each(Object.entries(FREE_TARGETS))(
    'gives at least one %s card in the target share of boosters',
    (rarity, target) => {
      let hits = 0
      for (let booster = 0; booster < BOOSTERS; booster++) {
        const start = booster * CARDS_PER_BOOSTER
        const content = cards.slice(start, start + CARDS_PER_BOOSTER)
        if (content.some((card) => card.rarityKey === rarity)) hits++
      }
      expectWithinFiveSigma(hits / BOOSTERS, target, BOOSTERS)
    },
  )

  it('matches the per-card weights', () => {
    const counts = new Map<string, number>()
    for (const card of cards) counts.set(card.rarityKey, (counts.get(card.rarityKey) ?? 0) + 1)
    for (const key of ORDER) {
      expectWithinFiveSigma(
        (counts.get(key) ?? 0) / cards.length,
        FREE_WEIGHTS[key]! / RATE_TOTAL,
        cards.length,
      )
    }
  })
})
