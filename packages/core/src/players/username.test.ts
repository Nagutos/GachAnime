import { describe, expect, it } from 'vitest'
import { toUsernameBase, usernameCandidate } from './username'

describe('toUsernameBase', () => {
  it('lowercases and replaces invalid characters', () => {
    expect(toUsernameBase('Nagi Seishiro')).toBe('nagi_seishiro')
    expect(toUsernameBase('  Héloïse--Ça va?! ')).toBe('heloise_ca_va')
  })

  it('falls back when the name has no usable characters', () => {
    expect(toUsernameBase('✨')).toBe('player')
    expect(toUsernameBase('ab')).toBe('player')
  })

  it('stays within the username format', () => {
    const base = toUsernameBase('x'.repeat(100))
    expect(base).toHaveLength(24)
    expect(usernameCandidate(base, 999)).toMatch(/^[a-z0-9_]{3,32}$/)
  })
})

describe('usernameCandidate', () => {
  it('adds a numeric suffix after the first attempt', () => {
    expect(usernameCandidate('nagi', 1)).toBe('nagi')
    expect(usernameCandidate('nagi', 2)).toBe('nagi_2')
  })
})
