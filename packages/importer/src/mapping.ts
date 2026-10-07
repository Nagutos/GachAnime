import { genderClassFromAniList, type GenderClass } from '@gachanime/game'
import type { CharacterRole } from '@gachanime/shared'
import type { AniListCharacter, AniListCharacterConnection, AniListMedia } from './anilist/queries'

/** Relations that keep two anime in the same franchise (ADR-014). */
export const FRANCHISE_RELATION_TYPES: ReadonlySet<string> = new Set([
  'SEQUEL',
  'PREQUEL',
  'PARENT',
  'SIDE_STORY',
  'ALTERNATIVE',
  'SUMMARY',
])

/** Music videos have no characters worth collecting. */
const EXCLUDED_FORMATS: ReadonlySet<string> = new Set(['MUSIC'])

interface MediaLike {
  type: string | null
  format: string | null
  isAdult: boolean | null
}

export function isImportableMedia(media: MediaLike): boolean {
  return (
    media.type === 'ANIME' && media.isAdult !== true && !EXCLUDED_FORMATS.has(media.format ?? '')
  )
}

/** AniList ids of the importable anime linked to `media` by a franchise relation. */
export function franchiseRelationIds(media: AniListMedia): number[] {
  const ids = media.relations.edges
    .filter((edge) => edge.node && FRANCHISE_RELATION_TYPES.has(edge.relationType ?? ''))
    .map((edge) => edge.node!)
    .filter(isImportableMedia)
    .map((node) => node.id)
  return [...new Set(ids)].sort((a, b) => a - b)
}

export interface MediaRow {
  anilistId: number
  format: string | null
  titleRomaji: string
  titleEnglish: string | null
  titleNative: string | null
  description: string | null
  seasonYear: number | null
  popularity: number
  favourites: number
  isAdult: boolean
  genres: string[]
  coverUrl: string | null
  siteUrl: string | null
  franchiseRelations: number[]
}

export function toMediaRow(media: AniListMedia): MediaRow {
  return {
    anilistId: media.id,
    format: media.format,
    titleRomaji:
      media.title.romaji ?? media.title.english ?? media.title.native ?? `AniList ${media.id}`,
    titleEnglish: media.title.english,
    titleNative: media.title.native,
    description: media.description,
    seasonYear: media.seasonYear,
    popularity: media.popularity ?? 0,
    favourites: media.favourites ?? 0,
    isAdult: media.isAdult ?? false,
    genres: (media.genres ?? []).filter((genre): genre is string => Boolean(genre)),
    coverUrl: media.coverImage?.large ?? null,
    siteUrl: media.siteUrl,
    franchiseRelations: franchiseRelationIds(media),
  }
}

export interface TagRow {
  anilistId: number
  name: string
  category: string | null
  isAdult: boolean
  rank: number
}

export function toTagRows(media: AniListMedia): TagRow[] {
  return (media.tags ?? []).map((tag) => ({
    anilistId: tag.id,
    name: tag.name,
    category: tag.category,
    isAdult: tag.isAdult ?? false,
    rank: Math.max(0, Math.min(100, tag.rank ?? 0)),
  }))
}

/** AniList serves this placeholder when a character has no picture. */
export function isPlaceholderImage(url: string | null | undefined): boolean {
  return !url || /\/default\.(jpg|jpeg|png|webp)$/i.test(url)
}

export interface CharacterRow {
  anilistId: number
  nameFull: string
  nameNative: string | null
  nameAlternatives: string[]
  description: string | null
  imageUrl: string
  genderRaw: string | null
  genderClass: GenderClass
  favourites: number
}

/** Null when the character must be skipped (no picture or no name). */
export function toCharacterRow(character: AniListCharacter): CharacterRow | null {
  const imageUrl = character.image?.large
  const nameFull = character.name.full?.trim() || character.name.native?.trim()
  if (isPlaceholderImage(imageUrl) || !imageUrl || !nameFull) return null
  return {
    anilistId: character.id,
    nameFull,
    nameNative: character.name.native,
    nameAlternatives: (character.name.alternative ?? []).filter((name): name is string =>
      Boolean(name?.trim()),
    ),
    description: character.description,
    imageUrl,
    genderRaw: character.gender,
    genderClass: genderClassFromAniList(character.gender),
    favourites: character.favourites ?? 0,
  }
}

export interface CharacterAppearance {
  character: CharacterRow
  role: CharacterRole
}

/**
 * Characters of one page, without duplicates and without the ones to skip.
 * `skipped` counts characters dropped for lack of a picture or name.
 */
export function toCharacterAppearances(connection: AniListCharacterConnection): {
  appearances: CharacterAppearance[]
  skipped: number
} {
  const byId = new Map<number, CharacterAppearance>()
  let skipped = 0
  for (const edge of connection.edges) {
    if (!edge.node) continue
    const character = toCharacterRow(edge.node)
    if (!character) {
      skipped += 1
      continue
    }
    if (!byId.has(character.anilistId)) {
      byId.set(character.anilistId, { character, role: edge.role ?? 'BACKGROUND' })
    }
  }
  return { appearances: [...byId.values()], skipped }
}
