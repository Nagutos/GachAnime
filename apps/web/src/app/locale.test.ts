import { describe, expect, it } from 'vitest'
import { pickLocale } from './locale'

describe('pickLocale', () => {
  const available = ['en', 'fr']

  it('uses the first supported preference', () => {
    expect(pickLocale(['de', 'fr', 'en'], available, 'en')).toBe('fr')
  })

  it('matches regional variants to their base language', () => {
    expect(pickLocale(['fr-CA'], available, 'en')).toBe('fr')
  })

  it('falls back when nothing matches', () => {
    expect(pickLocale(['ja', 'ko'], available, 'en')).toBe('en')
    expect(pickLocale([], available, 'en')).toBe('en')
  })
})
