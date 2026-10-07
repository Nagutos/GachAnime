import { describe, expect, it } from 'vitest'
import { formatCountdown } from './now'

describe('formatCountdown', () => {
  it('formats minutes and seconds, rounding up', () => {
    expect(formatCountdown(10_000, 0)).toBe('00:10')
    expect(formatCountdown(599_001, 0)).toBe('10:00')
    expect(formatCountdown(9_000_000, 0)).toBe('2:30:00')
  })

  it('never goes below zero', () => {
    expect(formatCountdown(0, 5_000)).toBe('00:00')
  })
})
