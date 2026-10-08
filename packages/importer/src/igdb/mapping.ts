import type { GenderClassValue } from '@gachanime/shared'
import type { AdultFilter } from '../mapping'
import { igdbImageUrl, type IgdbCharacter, type IgdbGame } from './api'

/** Adult games are skipped unless the `imports.adult` setting allows them (as with AniList). */
const ADULT_THEMES = new Set(['Erotic'])

/**
 * IGDB genre and theme names stored with AniList's spelling when both mean the same, so that a
 * genre pack (Sports, Sci-Fi…) matches anime and games alike. Other names are kept as is.
 */
const GENRE_ALIASES: Record<string, string> = {
  Sport: 'Sports',
  'Science fiction': 'Sci-Fi',
}

export function isImportableGame(
  game: IgdbGame,
  { allowAdult = false }: AdultFilter = {},
): boolean {
  return allowAdult || !(game.themes ?? []).some((theme) => ADULT_THEMES.has(theme.name))
}

/** The series a game belongs to: its first IGDB collection, else the game alone. */
export function seriesOfGame(game: IgdbGame): { igdbKey: string; title: string } {
  const collection = game.collections?.[0]
  return collection
    ? { igdbKey: `collection:${collection.id}`, title: collection.name }
    : { igdbKey: `game:${game.id}`, title: game.name }
}

export function toGameRow(game: IgdbGame) {
  const names = [...(game.genres ?? []), ...(game.themes ?? [])].map(
    (item) => GENRE_ALIASES[item.name] ?? item.name,
  )
  return {
    igdbId: game.id,
    name: game.name,
    summary: game.summary ?? null,
    coverUrl: game.cover ? igdbImageUrl(game.cover.image_id) : null,
    ratingCount: Math.round(game.total_rating_count ?? 0),
    genres: [...new Set(names)].sort(),
    themes: (game.themes ?? []).map((theme) => theme.name),
    releaseYear: game.first_release_date
      ? new Date(game.first_release_date * 1000).getUTCFullYear()
      : null,
    siteUrl: game.url ?? null,
  }
}

const LEGACY_GENDERS = ['Male', 'Female', 'Other']

export function igdbGenderClass(raw: string | null): GenderClassValue {
  if (raw === 'Female') return 'female'
  if (raw === 'Male') return 'male'
  return 'unclassified'
}

/** A character row (without rarity and popularity), or null when it has no portrait. */
export function toCharacterRow(character: IgdbCharacter) {
  if (!character.mug_shot) return null
  const genderRaw =
    character.character_gender?.name ??
    (character.gender === undefined ? null : (LEGACY_GENDERS[character.gender] ?? null))
  const alternatives = (character.akas ?? []).map((name) => name.trim()).filter(Boolean)
  return {
    igdbId: character.id,
    nameFull: character.name.trim(),
    nameAlternatives: [...new Set(alternatives)].filter((name) => name !== character.name),
    description: character.description?.trim() || null,
    imageUrl: igdbImageUrl(character.mug_shot.image_id),
    siteUrl: character.url ?? null,
    genderRaw,
    genderClass: igdbGenderClass(genderRaw),
  }
}
