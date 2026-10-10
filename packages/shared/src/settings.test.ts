import { describe, expect, it } from 'vitest'
import { defaultSettingValue, parseSettingValue } from './settings'

describe('settings', () => {
  it('provides the documented defaults', () => {
    expect(defaultSettingValue('boosters.free')).toEqual({ intervalSeconds: 600, maxCharges: 15 })
    expect(defaultSettingValue('missions.reset')).toEqual({ hour: 0, timeZone: 'Europe/Paris' })
  })

  it('fills missing fields with defaults and rejects invalid values', () => {
    expect(parseSettingValue('boosters.free', { maxCharges: 20 })).toEqual({
      intervalSeconds: 600,
      maxCharges: 20,
    })
    expect(() => parseSettingValue('missions.reset', { hour: 24 })).toThrow()
  })

  it('requires upgrade values to increase with the level', () => {
    expect(defaultSettingValue('upgrades.boosterStorage').levels).toHaveLength(5)
    expect(defaultSettingValue('recycle')).toEqual({ multiplier: 1 })
    expect(
      parseSettingValue('upgrades.recycleBonus', { levels: [{ cost: 10, value: 1.5 }] }),
    ).toEqual({ levels: [{ cost: 10, value: 1.5 }] })
    expect(parseSettingValue('upgrades.boosterSpeed', { levels: [] })).toEqual({ levels: [] })
    expect(() =>
      parseSettingValue('upgrades.boosterSpeed', {
        levels: [
          { cost: 10, value: 10 },
          { cost: 20, value: 10 },
        ],
      }),
    ).toThrow()
    expect(() =>
      parseSettingValue('upgrades.boosterSpeed', { levels: [{ cost: 10, value: 95 }] }),
    ).toThrow()
  })
})
