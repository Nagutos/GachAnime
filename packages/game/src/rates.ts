/** Rate tables are per-card weights in parts per million: they always sum to this total. */
export const RATE_TOTAL = 1_000_000

/** Number of cards in one booster (GAME_DESIGN §2). */
export const CARDS_PER_BOOSTER = 5

/** `{ rarityKey: ppm }` */
export type RateWeights = Record<string, number>

/**
 * Per-card probability giving a target chance of at least one such card in a booster of
 * `cards` independent cards: `p = 1 − (1 − P)^(1/cards)`.
 */
export function perCardProbability(perBooster: number, cards = CARDS_PER_BOOSTER): number {
  if (perBooster < 0 || perBooster > 1) throw new RangeError('Probability must be in [0, 1]')
  return 1 - (1 - perBooster) ** (1 / cards)
}

/** Chance of at least one card of probability `perCard` among `cards` cards. */
export function perBoosterProbability(perCard: number, cards = CARDS_PER_BOOSTER): number {
  if (perCard < 0 || perCard > 1) throw new RangeError('Probability must be in [0, 1]')
  return 1 - (1 - perCard) ** cards
}

/**
 * Builds a rate table from "at least one per booster" targets; `remainderKey` gets what is left
 * so that the weights sum to exactly `RATE_TOTAL`.
 */
export function weightsFromBoosterTargets(
  targets: Record<string, number>,
  remainderKey: string,
  cards = CARDS_PER_BOOSTER,
): RateWeights {
  const weights: RateWeights = {}
  let used = 0
  for (const [key, target] of Object.entries(targets)) {
    const weight = Math.round(perCardProbability(target, cards) * RATE_TOTAL)
    weights[key] = weight
    used += weight
  }
  if (used > RATE_TOTAL) throw new RangeError('Targets exceed 100 % per card')
  weights[remainderKey] = RATE_TOTAL - used
  return weights
}

/** Problems of a rate table (empty when valid): non-integer or negative weights, wrong sum. */
export function rateWeightsIssues(weights: RateWeights): string[] {
  const issues: string[] = []
  let sum = 0
  for (const [key, weight] of Object.entries(weights)) {
    if (!Number.isInteger(weight) || weight < 0) {
      issues.push(`Weight of "${key}" must be a non-negative integer`)
    }
    sum += weight
  }
  if (sum !== RATE_TOTAL) issues.push(`Weights sum to ${sum}, expected ${RATE_TOTAL}`)
  return issues
}

/**
 * Boosted rate table (weekly packs, GAME_DESIGN §5): the weight of `boostedFrom` and every rarer
 * rarity is multiplied by `multiplier`; the more common rarities give the difference, the most
 * common first, never below zero. When they cannot give it all, the boost is scaled down. The
 * result still sums to `RATE_TOTAL`. `rarityOrder` lists the rarity keys, most common first; an
 * unknown `boostedFrom` or a multiplier ≤ 1 leaves the table as it is.
 */
export function boostWeights(
  weights: RateWeights,
  rarityOrder: string[],
  boostedFrom: string,
  multiplier: number,
): RateWeights {
  const from = rarityOrder.indexOf(boostedFrom)
  if (from < 0 || multiplier <= 1) return { ...weights }
  const boosted = rarityOrder.slice(from)
  const donors = rarityOrder.slice(0, from)
  const extra = new Map(
    boosted.map((key) => {
      const weight = weights[key] ?? 0
      return [key, Math.round(weight * multiplier) - weight]
    }),
  )
  const wanted = [...extra.values()].reduce((sum, value) => sum + value, 0)
  const available = donors.reduce((sum, key) => sum + (weights[key] ?? 0), 0)
  if (wanted === 0 || available === 0) return { ...weights }
  // Not enough to give: every boost shrinks in proportion (rounded down, so it always fits).
  if (wanted > available) {
    for (const [key, value] of extra) extra.set(key, Math.floor((value * available) / wanted))
  }
  const result: RateWeights = { ...weights }
  let toTake = 0
  for (const [key, value] of extra) {
    result[key] = (weights[key] ?? 0) + value
    toTake += value
  }
  for (const key of donors) {
    const taken = Math.min(result[key] ?? 0, toTake)
    if (key in result) result[key] = result[key]! - taken
    toTake -= taken
  }
  return result
}
