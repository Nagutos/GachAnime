import { describe, expect, it } from 'vitest'
import { importParamsSchema, rosterImportSchema, slugify } from './catalog'

describe('slugify', () => {
  it('produces lowercase ASCII slugs', () => {
    expect(slugify('Shingeki no Kyojin: Season 2')).toBe('shingeki-no-kyojin-season-2')
    expect(slugify('Pokémon')).toBe('pokemon')
    expect(slugify('  Re:Zero −  Kara ')).toBe('re-zero-kara')
    expect(slugify('進撃の巨人')).toBe('')
  })
})

describe('importParamsSchema', () => {
  it('defaults to the top 500 with franchise expansion', () => {
    expect(importParamsSchema.parse({ mode: 'top' })).toEqual({
      mode: 'top',
      top: 500,
      expandFranchise: true,
    })
  })

  it('requires at least one id in ids mode', () => {
    expect(importParamsSchema.safeParse({ mode: 'ids', anilistIds: [] }).success).toBe(false)
  })
})

describe('rosterImportSchema', () => {
  const series = { slug: 'genshin-impact', title: 'Genshin Impact' }

  it('applies defaults', () => {
    const roster = rosterImportSchema.parse({
      series,
      characters: [{ key: 'lumine', name: 'Lumine' }],
    })
    expect(roster.series.kind).toBe('game')
    expect(roster.characters[0]).toMatchObject({ gender: 'unclassified', alternativeNames: [] })
  })

  it('rejects duplicate keys and non-http images', () => {
    const duplicate = [
      { key: 'a', name: 'A' },
      { key: 'a', name: 'B' },
    ]
    expect(rosterImportSchema.safeParse({ series, characters: duplicate }).success).toBe(false)
    const badImage = [{ key: 'a', name: 'A', imageUrl: 'file:///etc/passwd' }]
    expect(rosterImportSchema.safeParse({ series, characters: badImage }).success).toBe(false)
  })
})
