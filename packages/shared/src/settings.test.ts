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
})
