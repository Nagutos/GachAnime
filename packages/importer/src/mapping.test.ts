import { describe, expect, it } from 'vitest'
import type { AniListCharacter, AniListMedia } from './anilist/queries'
import {
  franchiseRelationIds,
  isImportableMedia,
  isPlaceholderImage,
  toCharacterAppearances,
  toCharacterRow,
  toMediaRow,
} from './mapping'

const character = (overrides: Partial<AniListCharacter> = {}): AniListCharacter => ({
  id: 1,
  name: {
    full: 'Mikasa Ackerman',
    native: 'ミカサ・アッカーマン',
    alternative: ['Mikasa', '', null],
  },
  description: 'A soldier.',
  image: { large: 'https://s4.anilist.co/file/anilistcdn/character/large/b40881-x.png' },
  gender: 'Female',
  favourites: 61_000,
  ...overrides,
})

const relation = (id: number, relationType: string, type = 'ANIME', isAdult = false) => ({
  relationType,
  node: { id, type, format: 'TV', isAdult },
})

const mediaFixture = (overrides: Partial<AniListMedia> = {}): AniListMedia => ({
  id: 16498,
  type: 'ANIME',
  format: 'TV',
  isAdult: false,
  popularity: 900_000,
  favourites: 90_000,
  seasonYear: 2013,
  siteUrl: 'https://anilist.co/anime/16498',
  description: 'Titans.',
  genres: ['Action', null],
  title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan', native: '進撃の巨人' },
  coverImage: { large: 'https://example.test/cover.jpg' },
  tags: [{ id: 1, name: 'Shounen', category: 'Demographic', rank: 90, isAdult: false }],
  relations: {
    edges: [
      relation(20958, 'SEQUEL'),
      relation(20958, 'SEQUEL'),
      relation(1, 'ADAPTATION', 'MANGA'),
      relation(2, 'CHARACTER'),
      relation(3, 'SIDE_STORY', 'ANIME', true),
      relation(4, 'SPIN_OFF'),
      relation(5, 'PARENT'),
    ],
  },
  characters: { pageInfo: { hasNextPage: false }, edges: [] },
  ...overrides,
})

describe('media mapping', () => {
  it('keeps franchise relations to non-adult anime only', () => {
    expect(franchiseRelationIds(mediaFixture())).toEqual([5, 20958])
  })

  it('excludes adult, music and non-anime media', () => {
    expect(isImportableMedia({ type: 'ANIME', format: 'TV', isAdult: false })).toBe(true)
    expect(isImportableMedia({ type: 'ANIME', format: 'TV', isAdult: true })).toBe(false)
    expect(isImportableMedia({ type: 'ANIME', format: 'MUSIC', isAdult: false })).toBe(false)
    expect(isImportableMedia({ type: 'MANGA', format: 'MANGA', isAdult: false })).toBe(false)
  })

  it('keeps adult media when the instance allows them', () => {
    const allowed = { allowAdult: true }
    expect(isImportableMedia({ type: 'ANIME', format: 'TV', isAdult: true }, allowed)).toBe(true)
    expect(isImportableMedia({ type: 'ANIME', format: 'MUSIC', isAdult: true }, allowed)).toBe(
      false,
    )
  })

  it('maps titles and drops empty genres', () => {
    expect(toMediaRow(mediaFixture())).toMatchObject({
      anilistId: 16498,
      titleRomaji: 'Shingeki no Kyojin',
      genres: ['Action'],
      franchiseRelations: [5, 20958],
    })
    const untitled = mediaFixture({ title: { romaji: null, english: null, native: null } })
    expect(toMediaRow(untitled).titleRomaji).toBe('AniList 16498')
  })
})

describe('character mapping', () => {
  it('maps names, gender and favourites', () => {
    expect(toCharacterRow(character())).toMatchObject({
      anilistId: 1,
      nameFull: 'Mikasa Ackerman',
      nameAlternatives: ['Mikasa'],
      genderClass: 'female',
      favourites: 61_000,
    })
  })

  it('skips characters without a picture or a name', () => {
    const placeholder = 'https://s4.anilist.co/file/anilistcdn/character/large/default.jpg'
    expect(isPlaceholderImage(placeholder)).toBe(true)
    expect(toCharacterRow(character({ image: { large: placeholder } }))).toBeNull()
    expect(toCharacterRow(character({ image: null }))).toBeNull()
    expect(
      toCharacterRow(character({ name: { full: ' ', native: null, alternative: null } })),
    ).toBeNull()
  })

  it('uses the native name when there is no full name', () => {
    const row = toCharacterRow(
      character({ name: { full: null, native: 'ミカサ', alternative: null } }),
    )
    expect(row?.nameFull).toBe('ミカサ')
  })

  it('deduplicates a page and counts skipped characters', () => {
    const result = toCharacterAppearances({
      pageInfo: { hasNextPage: false },
      edges: [
        { role: 'MAIN', node: character() },
        { role: 'SUPPORTING', node: character() },
        { role: null, node: character({ id: 2 }) },
        { role: 'BACKGROUND', node: character({ id: 3, image: { large: null } }) },
        { role: 'MAIN', node: null },
      ],
    })
    expect(result.appearances.map((a) => [a.character.anilistId, a.role])).toEqual([
      [1, 'MAIN'],
      [2, 'BACKGROUND'],
    ])
    expect(result.skipped).toBe(1)
  })
})
