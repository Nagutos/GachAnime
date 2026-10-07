import { characters, series, seriesCharacters, type Database } from '@gachanime/db'
import { RarityTable } from '../catalog/rarities'

export interface FixtureCharacter {
  name: string
  rarity: string
  favourites?: number
  isActive?: boolean
}

/** Inserts an active manual series with the given characters; returns their ids by name. */
export async function insertSeriesWithCharacters(
  db: Database,
  input: { slug: string; title: string; popularity?: number; isActive?: boolean },
  members: FixtureCharacter[],
): Promise<{ seriesId: number; ids: Record<string, number> }> {
  const table = await RarityTable.load(db)
  const [created] = await db
    .insert(series)
    .values({
      slug: input.slug,
      title: input.title,
      kind: 'game',
      source: 'manual',
      popularity: input.popularity ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning({ id: series.id })
  const ids: Record<string, number> = {}
  for (const member of members) {
    const [character] = await db
      .insert(characters)
      .values({
        source: 'manual',
        manualKey: `${input.slug}/${member.name.toLowerCase().replace(/\W+/g, '-')}`,
        nameFull: member.name,
        imageUrl: `https://img.example.test/${encodeURIComponent(member.name)}.png`,
        rarityId: table.idForKey(member.rarity),
        favourites: member.favourites ?? null,
        isActive: member.isActive ?? true,
      })
      .returning({ id: characters.id })
    ids[member.name] = character!.id
    await db.insert(seriesCharacters).values({ seriesId: created!.id, characterId: character!.id })
  }
  return { seriesId: created!.id, ids }
}
