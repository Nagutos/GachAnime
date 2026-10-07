/** A rarity with its minimum AniList favourites (ADR-015: absolute thresholds). */
export interface RarityThreshold<K extends string = string> {
  key: K
  favouritesThreshold: number
}

/**
 * Default rarity of a character: the rarity with the highest threshold the favourites reach.
 * Characters below every threshold (or without favourites) get the lowest-threshold rarity.
 */
export function rarityFromFavourites<K extends string>(
  favourites: number | null | undefined,
  thresholds: readonly RarityThreshold<K>[],
): K {
  if (thresholds.length === 0) throw new Error('At least one rarity is required')
  const sorted = [...thresholds].sort((a, b) => b.favouritesThreshold - a.favouritesThreshold)
  const value = favourites ?? 0
  const match = sorted.find((rarity) => value >= rarity.favouritesThreshold)
  return (match ?? sorted[sorted.length - 1]!).key
}
