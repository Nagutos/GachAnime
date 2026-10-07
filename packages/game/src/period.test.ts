import { describe, expect, it } from 'vitest'
import { nextResetAt, periodKey, periodStartAt } from './period'

const PARIS = { hour: 0, timeZone: 'Europe/Paris' }

describe('periodKey', () => {
  it('uses the local date in the time zone', () => {
    // 23:30 UTC on Oct 7 is 01:30 on Oct 8 in Paris (UTC+2).
    expect(periodKey(new Date('2026-10-07T23:30:00Z'), PARIS)).toBe('2026-10-08')
    expect(periodKey(new Date('2026-10-07T21:59:59Z'), PARIS)).toBe('2026-10-07')
  })

  it('starts a period at the reset hour', () => {
    const at6 = { hour: 6, timeZone: 'Europe/Paris' }
    expect(periodKey(new Date('2026-10-08T03:59:00Z'), at6)).toBe('2026-10-07') // 05:59 local
    expect(periodKey(new Date('2026-10-08T04:00:00Z'), at6)).toBe('2026-10-08') // 06:00 local
  })

  it('keeps one period per local day across DST changes', () => {
    // Paris switches to winter time on 2026-10-25 (03:00 → 02:00).
    expect(periodKey(new Date('2026-10-24T22:00:00Z'), PARIS)).toBe('2026-10-25')
    expect(periodKey(new Date('2026-10-25T22:59:00Z'), PARIS)).toBe('2026-10-25')
    expect(periodKey(new Date('2026-10-25T23:00:00Z'), PARIS)).toBe('2026-10-26')
    // Summer time on 2026-03-29 (02:00 → 03:00).
    expect(periodKey(new Date('2026-03-28T23:00:00Z'), PARIS)).toBe('2026-03-29')
    expect(periodKey(new Date('2026-03-29T21:59:00Z'), PARIS)).toBe('2026-03-29')
    expect(periodKey(new Date('2026-03-29T22:00:00Z'), PARIS)).toBe('2026-03-30')
  })
})

describe('nextResetAt', () => {
  it('returns the next local reset', () => {
    expect(nextResetAt(new Date('2026-10-07T12:00:00Z'), PARIS)).toEqual(
      new Date('2026-10-07T22:00:00Z'),
    )
  })

  it('gives a 25 h day when the clocks go back, 23 h when they go forward', () => {
    expect(nextResetAt(new Date('2026-10-25T12:00:00Z'), PARIS)).toEqual(
      new Date('2026-10-25T23:00:00Z'),
    )
    expect(nextResetAt(new Date('2026-03-29T12:00:00Z'), PARIS)).toEqual(
      new Date('2026-03-29T22:00:00Z'),
    )
  })

  it('resolves a reset hour skipped by DST to a valid instant', () => {
    // 02:00 does not exist in Paris on 2026-03-29.
    const at2 = { hour: 2, timeZone: 'Europe/Paris' }
    const reset = nextResetAt(new Date('2026-03-28T12:00:00Z'), at2)
    expect(periodKey(reset, at2)).toBe('2026-03-29')
    expect(periodKey(new Date(reset.getTime() - 1000), at2)).toBe('2026-03-28')
  })
})

describe('periodStartAt', () => {
  it('returns the last local reset', () => {
    expect(periodStartAt(new Date('2026-10-07T12:00:00Z'), PARIS)).toEqual(
      new Date('2026-10-06T22:00:00Z'),
    )
    // Just after the winter time change, the period started at 00:00 UTC+2.
    expect(periodStartAt(new Date('2026-10-25T12:00:00Z'), PARIS)).toEqual(
      new Date('2026-10-24T22:00:00Z'),
    )
  })
})
