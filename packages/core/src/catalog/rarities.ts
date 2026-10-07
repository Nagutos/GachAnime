import { rarities, type Executor } from '@gachanime/db'
import { rarityFromFavourites } from '@gachanime/game'
import { asc } from 'drizzle-orm'
import { AppError } from '../errors'

export interface RarityRow {
  id: number
  key: string
  sortOrder: number
  favouritesThreshold: number
}

export async function loadRarities(db: Executor): Promise<RarityRow[]> {
  const rows = await db
    .select({
      id: rarities.id,
      key: rarities.key,
      sortOrder: rarities.sortOrder,
      favouritesThreshold: rarities.favouritesThreshold,
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
