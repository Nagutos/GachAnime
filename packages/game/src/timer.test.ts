import { describe, expect, it } from 'vitest'
import { consumeFreeCharges, freeChargeState } from './timer'

const RULES = { intervalSeconds: 600, maxCharges: 15 }
const T0 = new Date('2026-10-07T12:00:00Z')
const minutes = (value: number) => new Date(T0.getTime() + value * 60_000)

describe('freeChargeState', () => {
  it('counts one charge per elapsed interval', () => {
    expect(freeChargeState(T0, minutes(0), RULES)).toEqual({
      available: 0,
      max: 15,
      nextChargeAt: minutes(10),
      fullAt: minutes(150),
    })
    expect(freeChargeState(T0, minutes(25), RULES)).toMatchObject({
      available: 2,
      nextChargeAt: minutes(30),
    })
  })

  it('caps the charges', () => {
    expect(freeChargeState(T0, minutes(10_000), RULES)).toEqual({
      available: 15,
      max: 15,
      nextChargeAt: null,
      fullAt: null,
    })
    // A brand-new player (anchor far in the past) starts full.
    expect(freeChargeState(new Date(0), T0, RULES).available).toBe(15)
  })

  it('never reports negative charges for an anchor in the future', () => {
    expect(freeChargeState(minutes(30), T0, RULES)).toMatchObject({
      available: 0,
      nextChargeAt: minutes(40),
    })
  })
})

describe('consumeFreeCharges', () => {
  it('moves the anchor forward by the consumed intervals', () => {
    const anchor = consumeFreeCharges(T0, minutes(35), RULES, 2)
    expect(anchor).toEqual(minutes(20))
    // The partial interval in progress is kept: 1 charge left, next one at 40 min.
    expect(freeChargeState(anchor, minutes(35), RULES)).toMatchObject({
      available: 1,
      nextChargeAt: minutes(40),
    })
  })

  it('does not bank time beyond the cap', () => {
    const now = minutes(10_000)
    const anchor = consumeFreeCharges(T0, now, RULES, 10)
    expect(freeChargeState(anchor, now, RULES).available).toBe(5)
    expect(anchor).toEqual(new Date(now.getTime() - 5 * 600_000))
  })

  it('refuses to consume more than available', () => {
    expect(() => consumeFreeCharges(T0, minutes(15), RULES, 2)).toThrow(/Only 1/)
    expect(() => consumeFreeCharges(T0, minutes(15), RULES, 0)).toThrow(RangeError)
  })
})
