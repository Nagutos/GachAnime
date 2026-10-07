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
