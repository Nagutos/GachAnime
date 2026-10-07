import { describe, expect, it } from 'vitest'
import { boosterPrice, recyclableCopies } from './economy'
import { seededRng } from './rng'
import { simulateEconomy } from './simulation'

describe('recyclableCopies', () => {
  it.each([
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 1],
    [5, 0, 4],
    [5, 2, 2],
    [3, 3, 0],
  ])('quantity %i with %i locked → %i', (quantity, locked, expected) => {
    expect(recyclableCopies(quantity, locked)).toBe(expected)
  })
})

describe('boosterPrice', () => {
  it('multiplies the tier price and applies the surcharge per booster', () => {
    expect(boosterPrice(150, 1)).toBe(150)
    expect(boosterPrice(150, 10)).toBe(1500)
    expect(boosterPrice(500, 1, 20)).toBe(600)
    expect(boosterPrice(155, 2, 20)).toBe(372)
  })

  it('refuses invalid input', () => {
    expect(() => boosterPrice(-1, 1)).toThrow(RangeError)
    expect(() => boosterPrice(100, 0)).toThrow(RangeError)
  })
})

describe('simulateEconomy', () => {
  const base = {
    rarityOrder: ['common', 'rare'] as const,
    weights: { common: 500_000, rare: 500_000 },
    recycleValues: { common: 1, rare: 2 },
    otherGemsPerDay: 10,
    rng: seededRng(5),
  }

  it('earns nothing from recycling while every card is new', () => {
    const days = simulateEconomy({
      ...base,
      poolSizes: { common: 1_000_000, rare: 1_000_000 },
      days: 1,
      freeBoostersPerDay: 2,
    })
    expect(days).toEqual([{ day: 1, recycleGems: 0, totalGems: 10, distinctOwned: 10 }])
  })

  it('recycles every duplicate of a tiny catalog', () => {
    const [day] = simulateEconomy({
      ...base,
      poolSizes: { common: 1, rare: 1 },
      days: 1,
      freeBoostersPerDay: 10,
    })
    // 50 cards, 2 distinct characters: 48 duplicates worth 1 or 2 gems.
    expect(day!.distinctOwned).toBe(2)
    expect(day!.recycleGems).toBeGreaterThanOrEqual(48)
    expect(day!.recycleGems).toBeLessThanOrEqual(96)
  })
})
