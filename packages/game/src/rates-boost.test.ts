import { describe, expect, it } from 'vitest'
import { boostWeights, RATE_TOTAL } from './rates'

const ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic']
const FREE = { common: 525_097, rare: 432_233, epic: 37_977, legendary: 4_032, mythic: 661 }
const sum = (weights: Record<string, number>) =>
  Object.values(weights).reduce((total, value) => total + value, 0)

describe('boostWeights', () => {
  it('multiplies epic and rarer, the most common rarity gives the difference', () => {
    const boosted = boostWeights(FREE, ORDER, 'epic', 1.5)
    expect(boosted).toEqual({
      common: 525_097 - (18_989 + 2_016 + 331),
      rare: 432_233,
      epic: 56_966,
      legendary: 6_048,
      mythic: 992,
    })
    expect(sum(boosted)).toBe(RATE_TOTAL)
  })

  it('takes from the next common rarity once the first one is empty', () => {
    const boosted = boostWeights(
      { common: 1_000, rare: 499_000, epic: 500_000 },
      ['common', 'rare', 'epic'],
      'epic',
      1.5,
    )
    expect(boosted).toEqual({ common: 0, rare: 250_000, epic: 750_000 })
  })

  it('scales the boost down when the common rarities cannot give it all', () => {
    const boosted = boostWeights(
      { common: 100_000, epic: 450_000, mythic: 450_000 },
      ['common', 'epic', 'mythic'],
      'epic',
      2,
    )
    expect(boosted).toEqual({ common: 0, epic: 500_000, mythic: 500_000 })
    expect(sum(boosted)).toBe(RATE_TOTAL)
  })

  it('leaves the table as it is without a boost', () => {
    expect(boostWeights(FREE, ORDER, 'epic', 1)).toEqual(FREE)
    expect(boostWeights(FREE, ORDER, 'unknown', 2)).toEqual(FREE)
  })
})
