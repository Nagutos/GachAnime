/** A rarity with its minimum AniList favourites (ADR-015: absolute thresholds). */
export interface RarityThreshold<K extends string = string> {
  key: K
  favouritesThreshold: number
}

/** A rarity with its minimum IGDB game popularity (ADR-026). */
export interface GameRarityThreshold<K extends string = string> {
  key: K
  gamePopularityThreshold: number
}

/** The rarity with the highest threshold `value` reaches, else the lowest-threshold rarity. */
function rarityFromThreshold<K extends string, T extends { key: K }>(
  value: number | null | undefined,
  rows: readonly T[],
  threshold: (row: T) => number,
): K {
  if (rows.length === 0) throw new Error('At least one rarity is required')
  const sorted = [...rows].sort((a, b) => threshold(b) - threshold(a))
  const match = sorted.find((row) => (value ?? 0) >= threshold(row))
  return (match ?? sorted[sorted.length - 1]!).key
}

/**
 * Default rarity of an AniList character: the rarity with the highest threshold the favourites
 * reach. Characters below every threshold (or without favourites) get the lowest one.
 */
export function rarityFromFavourites<K extends string>(
  favourites: number | null | undefined,
  thresholds: readonly RarityThreshold<K>[],
): K {
  return rarityFromThreshold(favourites, thresholds, (row) => row.favouritesThreshold)
}

/**
 * Default rarity of a video game character (IGDB): from the rating count of its most popular
 * game, with the same rule as favourites.
 */
export function rarityFromGamePopularity<K extends string>(
  popularity: number | null | undefined,
  thresholds: readonly GameRarityThreshold<K>[],
): K {
  return rarityFromThreshold(popularity, thresholds, (row) => row.gamePopularityThreshold)
}
