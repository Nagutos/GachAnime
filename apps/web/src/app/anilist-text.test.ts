import { describe, expect, it } from 'vitest'
import { parseAniListDescription } from './anilist-text'

describe('parseAniListDescription', () => {
  it('returns nothing for an empty description', () => {
    expect(parseAniListDescription(null)).toEqual([])
    expect(parseAniListDescription('  ')).toEqual([])
  })

  it('strips markdown and HTML into paragraphs', () => {
    const raw =
      '__Height:__ 170 cm<br>\n__Age:__ 17\n\nA [student](https://anilist.co/x) who loves **tea** &amp; _books_.'
    expect(parseAniListDescription(raw)).toEqual([
      {
        spoiler: false,
        // `<br>` + newline makes a paragraph break.
        paragraphs: ['Height: 170 cm', 'Age: 17', 'A student who loves tea & books.'],
      },
    ])
  })

  it('separates spoilers, even across paragraphs', () => {
    expect(parseAniListDescription('Intro.\n\n~!She is the king.\n\nReally.!~ Outro.')).toEqual([
      { spoiler: false, paragraphs: ['Intro.'] },
      { spoiler: true, paragraphs: ['She is the king.', 'Really.'] },
      { spoiler: false, paragraphs: ['Outro.'] },
    ])
  })
})
