import { describe, expect, it } from 'vitest'
import { cleanLocalized, plainText } from './text'

describe('plainText', () => {
  it('turns AniList HTML into plain text', () => {
    expect(plainText('Titans.<br><br>\n<i>(Source: Kodansha)</i> &amp; more')).toBe(
      'Titans.\n\n(Source: Kodansha) & more',
    )
    expect(plainText(null)).toBe('')
  })
})

describe('cleanLocalized', () => {
  it('drops empty translations', () => {
    expect(cleanLocalized({ en: 'Rare', fr: '  ' })).toEqual({ en: 'Rare' })
    expect(cleanLocalized({ en: 'Rare', fr: 'Rare' })).toEqual({ en: 'Rare', fr: 'Rare' })
  })
})
