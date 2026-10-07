import { describe, expect, it } from 'vitest'
import { rateWeightsSchema } from './rates'

describe('rateWeightsSchema', () => {
  it('accepts weights summing to one million', () => {
    expect(rateWeightsSchema.safeParse({ common: 600_000, rare: 400_000 }).success).toBe(true)
  })

  it('refuses a wrong sum, negative or decimal weights', () => {
    expect(rateWeightsSchema.safeParse({ common: 999_999 }).success).toBe(false)
    expect(rateWeightsSchema.safeParse({ common: 1_000_001, rare: -1 }).success).toBe(false)
    expect(rateWeightsSchema.safeParse({ common: 999_999.5, rare: 0.5 }).success).toBe(false)
  })
})
