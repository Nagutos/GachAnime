import { rarities, type Executor } from '@gachanime/db'
import { rarityFromFavourites, rarityFromGamePopularity } from '@gachanime/game'
import { localizedTextSchema, type PublicRarity } from '@gachanime/shared'
import { asc } from 'drizzle-orm'
import { AppError } from '../errors'

export interface RarityRow {
  id: number
  key: string
  sortOrder: number
  favouritesThreshold: number
  gamePopularityThreshold: number
}

export async function loadRarities(db: Executor): Promise<RarityRow[]> {
  const rows = await db
    .select({
      id: rarities.id,
      key: rarities.key,
      sortOrder: rarities.sortOrder,
      favouritesThreshold: rarities.favouritesThreshold,
      gamePopularityThreshold: rarities.gamePopularityThreshold,
    })
    .from(rarities)
    .orderBy(asc(rarities.sortOrder))
  if (rows.length === 0) throw new Error('No rarity configured: run the seed (pnpm db:migrate)')
  return rows
}

/** Lookup helpers over the configured rarities. */
export class RarityTable {
  private readonly byKey: Map<string, RarityRow>
  private readonly byId: Map<number, RarityRow>

  constructor(readonly rows: RarityRow[]) {
    this.byKey = new Map(rows.map((row) => [row.key, row]))
    this.byId = new Map(rows.map((row) => [row.id, row]))
  }

  static async load(db: Executor): Promise<RarityTable> {
    return new RarityTable(await loadRarities(db))
  }

  /** Default rarity of an AniList character (ADR-015). */
  idForFavourites(favourites: number | null): number {
    return this.byKey.get(rarityFromFavourites(favourites, this.rows))!.id
  }

  keyForFavourites(favourites: number | null): string {
    return rarityFromFavourites(favourites, this.rows)
  }

  /** Default rarity of an IGDB character (ADR-026). */
  idForGamePopularity(popularity: number | null): number {
    return this.byKey.get(rarityFromGamePopularity(popularity, this.rows))!.id
  }

  /** Default rarity of an imported character, from its source's popularity measure. */
  idForImported(character: {
    source: 'anilist' | 'igdb' | 'manual'
    favourites: number | null
    gamePopularity: number | null
  }): number {
    if (character.source === 'anilist') return this.idForFavourites(character.favourites)
    if (character.source === 'igdb') return this.idForGamePopularity(character.gamePopularity)
    return this.lowest.id
  }

  /** The lowest rarity: default for manual characters. */
  get lowest(): RarityRow {
    return this.rows[0]!
  }

  idForKey(key: string): number {
    const row = this.byKey.get(key)
    if (!row) throw new AppError('VALIDATION_FAILED', `Unknown rarity "${key}"`)
    return row.id
  }

  keyForId(id: number): string {
    return this.byId.get(id)?.key ?? 'unknown'
  }
}

/** Rarities as shown to players (names, colors), lowest first. */
export async function listPublicRarities(db: Executor): Promise<PublicRarity[]> {
  const rows = await db
    .select({
      key: rarities.key,
      sortOrder: rarities.sortOrder,
      name: rarities.name,
      colorToken: rarities.colorToken,
    })
    .from(rarities)
    .orderBy(asc(rarities.sortOrder))
  return rows.map((row) => ({ ...row, name: localizedTextSchema.parse(row.name) }))
}
