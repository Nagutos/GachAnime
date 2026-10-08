import { describe, expect, it } from 'vitest'
import { rarityFromFavourites, rarityFromGamePopularity } from './rarity'

const thresholds = [
  { key: 'common', favouritesThreshold: 0 },
  { key: 'mythic', favouritesThreshold: 50_000 },
  { key: 'rare', favouritesThreshold: 500 },
  { key: 'legendary', favouritesThreshold: 15_000 },
  { key: 'epic', favouritesThreshold: 3_000 },
]

describe('rarityFromFavourites', () => {
  it.each([
    [0, 'common'],
    [499, 'common'],
    [500, 'rare'],
    [2_999, 'rare'],
    [3_000, 'epic'],
    [15_000, 'legendary'],
    [49_999, 'legendary'],
    [50_000, 'mythic'],
    [250_000, 'mythic'],
  ])('%i favourites → %s', (favourites, expected) => {
    expect(rarityFromFavourites(favourites, thresholds)).toBe(expected)
  })

  it('treats missing favourites as zero', () => {
    expect(rarityFromFavourites(null, thresholds)).toBe('common')
  })

  it('falls back to the lowest rarity when no threshold is reached', () => {
    const noZero = [
      { key: 'rare', favouritesThreshold: 500 },
      { key: 'epic', favouritesThreshold: 3_000 },
    ]
    expect(rarityFromFavourites(10, noZero)).toBe('rare')
  })

  it('requires at least one rarity', () => {
    expect(() => rarityFromFavourites(10, [])).toThrow()
  })
})

describe('rarityFromGamePopularity', () => {
  const gameThresholds = [
    { key: 'common', gamePopularityThreshold: 0 },
    { key: 'epic', gamePopularityThreshold: 500 },
    { key: 'rare', gamePopularityThreshold: 150 },
  ]

  it.each([
    [null, 'common'],
    [149, 'common'],
    [150, 'rare'],
    [499, 'rare'],
    [5_000, 'epic'],
  ])('%s ratings → %s', (popularity, expected) => {
    expect(rarityFromGamePopularity(popularity, gameThresholds)).toBe(expected)
  })
})
