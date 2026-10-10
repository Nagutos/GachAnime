import { describe, expect, it } from 'vitest'
import { freeChargeState, rebaseFreeCharges } from './timer'
import {
  recycleFactor,
  recycleValuePerCopy,
  upgradedFreeChargeRules,
  upgradeValue,
} from './upgrades'

const LEVELS = [
  { cost: 100, value: 2 },
  { cost: 200, value: 4 },
]

describe('upgradeValue', () => {
  it('reads the level value, null at level 0, the last level when levels were removed', () => {
    expect(upgradeValue(LEVELS, 0)).toBeNull()
    expect(upgradeValue(LEVELS, 1)).toBe(2)
    expect(upgradeValue(LEVELS, 2)).toBe(4)
    expect(upgradeValue(LEVELS, 5)).toBe(4)
    expect(upgradeValue([], 3)).toBeNull()
  })
})

describe('upgradedFreeChargeRules', () => {
  it('adds charges and shortens the interval', () => {
    expect(
      upgradedFreeChargeRules(
        { intervalSeconds: 600, maxCharges: 15 },
        { extraCharges: 4, intervalReductionPercent: 25 },
      ),
    ).toEqual({ intervalSeconds: 450, maxCharges: 19 })
    expect(
      upgradedFreeChargeRules(
        { intervalSeconds: 600, maxCharges: 15 },
        { extraCharges: 0, intervalReductionPercent: 0 },
      ),
    ).toEqual({ intervalSeconds: 600, maxCharges: 15 })
  })
})

describe('recycle factor', () => {
  it('multiplies exactly and rounds half up per copy', () => {
    expect(recycleValuePerCopy(100, recycleFactor(1, 1))).toBe(100)
    expect(recycleValuePerCopy(100, recycleFactor(1, 1.15))).toBe(115)
    expect(recycleValuePerCopy(2, recycleFactor(1, 1.25))).toBe(3)
    expect(recycleValuePerCopy(2, recycleFactor(1, 1.1))).toBe(2)
    expect(recycleValuePerCopy(25, recycleFactor(2, 1.5))).toBe(75)
    expect(recycleValuePerCopy(500, recycleFactor(0, 2))).toBe(0)
  })
})

describe('rebaseFreeCharges', () => {
  const before = { intervalSeconds: 600, maxCharges: 15 }
  const T0 = new Date('2026-10-07T12:00:00Z')
  const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)

  it('keeps the charges and the progress toward the next one', () => {
    const after = { intervalSeconds: 300, maxCharges: 15 }
    // 3 charges and half an interval elapsed.
    const anchor = rebaseFreeCharges(T0, at(35), before, after)
    const state = freeChargeState(anchor, at(35), after)
    expect(state.available).toBe(3)
    expect(state.nextChargeAt).toEqual(new Date(at(35).getTime() + 150_000))
  })

  it('never refills a full player when the cap grows', () => {
    const after = { intervalSeconds: 600, maxCharges: 20 }
    const now = at(100_000)
    const anchor = rebaseFreeCharges(T0, now, before, after)
    expect(freeChargeState(anchor, now, after)).toMatchObject({
      available: 15,
      nextChargeAt: at(100_010),
    })
  })
})
