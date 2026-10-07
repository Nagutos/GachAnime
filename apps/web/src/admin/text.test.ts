import { describe, expect, it } from 'vitest'
import { plainText } from './text'

describe('plainText', () => {
  it('turns AniList HTML into plain text', () => {
    expect(plainText('Titans.<br><br>\n<i>(Source: Kodansha)</i> &amp; more')).toBe(
      'Titans.\n\n(Source: Kodansha) & more',
    )
    expect(plainText(null)).toBe('')
  })
})
