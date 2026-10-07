import { describe, expect, it } from 'vitest'
import {
  perBoosterProbability,
  perCardProbability,
  RATE_TOTAL,
  rateWeightsIssues,
  weightsFromBoosterTargets,
} from './rates'

describe('rate conversions', () => {
  it('converts a per-booster target to a per-card probability and back', () => {
    const p = perCardProbability(0.176)
    expect(p).toBeCloseTo(0.037977, 6)
    expect(perBoosterProbability(p)).toBeCloseTo(0.176, 12)
  })

  it('builds the documented free booster table (GAME_DESIGN §2)', () => {
    const weights = weightsFromBoosterTargets(
      { rare: 0.941, epic: 0.176, legendary: 0.02, mythic: 0.0033 },
      'common',
    )
    expect(weights).toEqual({
      rare: 432_233,
      epic: 37_977,
      legendary: 4_032,
      mythic: 661,
      common: 525_097,
    })
    expect(rateWeightsIssues(weights)).toEqual([])
  })

  it('reports invalid weights', () => {
    expect(rateWeightsIssues({ common: RATE_TOTAL })).toEqual([])
    expect(rateWeightsIssues({ common: 999_999 })).toHaveLength(1)
    expect(rateWeightsIssues({ common: 1.5, rare: RATE_TOTAL - 1.5 })).toHaveLength(2)
    expect(rateWeightsIssues({ common: -1, rare: RATE_TOTAL + 1 })).toHaveLength(1)
  })

  it('refuses probabilities outside [0, 1]', () => {
    expect(() => perCardProbability(1.2)).toThrow(RangeError)
    expect(() => weightsFromBoosterTargets({ rare: 1, epic: 1 }, 'common')).toThrow(RangeError)
  })
})
