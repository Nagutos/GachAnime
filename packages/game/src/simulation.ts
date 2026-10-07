import { drawCards } from './draw'
import { CARDS_PER_BOOSTER, type RateWeights } from './rates'
import type { Rng } from './rng'

export interface EconomySimulationInput<K extends string> {
  rarityOrder: readonly K[]
  /** Drawable characters per rarity (real catalog). */
  poolSizes: Partial<Record<K, number>>
  /** Free booster rate table. */
  weights: RateWeights
  recycleValues: Partial<Record<K, number>>
  days: number
  freeBoostersPerDay: number
  /** Fixed daily income besides recycling (missions). */
  otherGemsPerDay: number
  rng: Rng
}

export interface EconomyDay {
  day: number
  recycleGems: number
  totalGems: number
  distinctOwned: number
}

/**
 * One player opening only free boosters and recycling every duplicate each day (no spending):
 * measures gem income over time, to size booster prices (GAME_DESIGN §3).
 */
export function simulateEconomy<K extends string>(input: EconomySimulationInput<K>): EconomyDay[] {
  const owned = new Set<string>()
  const days: EconomyDay[] = []
  let totalGems = 0
  for (let day = 1; day <= input.days; day++) {
    const cards = drawCards({
      rarityOrder: input.rarityOrder,
      weights: input.weights,
      poolSizes: input.poolSizes,
      count: input.freeBoostersPerDay * CARDS_PER_BOOSTER,
      rng: input.rng,
    })
    let recycleGems = 0
    for (const card of cards) {
      const id = `${card.rarityKey}:${card.index}`
      if (owned.has(id)) recycleGems += input.recycleValues[card.rarityKey] ?? 0
      else owned.add(id)
    }
    totalGems += recycleGems + input.otherGemsPerDay
    days.push({ day, recycleGems, totalGems, distinctOwned: owned.size })
  }
  return days
}
