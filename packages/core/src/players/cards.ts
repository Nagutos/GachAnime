import { characters, rarities, type Executor } from '@gachanime/db'
import type { CharacterCard, SeriesRef } from '@gachanime/shared'
import { eq, inArray, sql } from 'drizzle-orm'
import { publicImageUrl } from '../catalog/images'

// Correlated subqueries name the outer column explicitly ("characters"."id", see CLAUDE.md).

/** Most popular active series of the character, as `{ id, title }` (null when none). */
export const primarySeries = sql<SeriesRef | null>`(
  SELECT json_build_object('id', s.id, 'title', s.title)
  FROM series_characters sc JOIN series s ON s.id = sc.series_id
  WHERE sc.character_id = "characters"."id" AND s.is_active
  ORDER BY s.popularity DESC, s.id
  LIMIT 1)`

/** Every active series of the character. */
export const activeSeriesList = sql<SeriesRef[]>`coalesce((
  SELECT json_agg(json_build_object('id', s.id, 'title', s.title) ORDER BY s.popularity DESC, s.id)
  FROM series_characters sc JOIN series s ON s.id = sc.series_id
  WHERE sc.character_id = "characters"."id" AND s.is_active), '[]'::json)`

/** Columns needed to build a `CharacterCard` (query must join `rarities`). */
export const characterCardColumns = {
  id: characters.id,
  name: characters.nameFull,
  nameNative: characters.nameNative,
  imageUrl: characters.imageUrl,
  imagePath: characters.imagePath,
  rarityKey: rarities.key,
  series: primarySeries,
}

export interface CharacterCardRow {
  id: number
  name: string
  nameNative: string | null
  imageUrl: string | null
  imagePath: string | null
  rarityKey: string
  series: SeriesRef | null
}

export function toCharacterCard(row: CharacterCardRow): CharacterCard {
  return {
    id: row.id,
    name: row.name,
    nameNative: row.nameNative,
    imageUrl: publicImageUrl(row.imagePath, row.imageUrl),
    rarityKey: row.rarityKey,
    series: row.series,
  }
}

/** Cards of the given characters, by id. */
export async function loadCharacterCards(
  db: Executor,
  ids: number[],
): Promise<Map<number, CharacterCard>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select(characterCardColumns)
    .from(characters)
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
    .where(inArray(characters.id, ids))
  return new Map(rows.map((row) => [row.id, toCharacterCard(row)]))
}
