import type { FreeChargeRules } from './timer'

/**
 * Player upgrades bought with gems (GAME_DESIGN §9). Each upgrade has data-defined levels; the
 * value of a level is absolute (level 3 gives `levels[2].value`, not a sum).
 */
export interface UpgradeLevel {
  cost: number
  value: number
}

/**
 * Value of an upgrade at `level` (0 = not bought): null without effect. A level removed later by
 * an admin falls back to the last configured one.
 */
export function upgradeValue(levels: readonly UpgradeLevel[], level: number): number | null {
  const effective = Math.min(level, levels.length)
  return effective > 0 ? levels[effective - 1]!.value : null
}

export interface FreeChargeUpgrades {
  /** Charges stored on top of the base cap. */
  extraCharges: number
  /** Interval shortened by this percentage. */
  intervalReductionPercent: number
}

export function upgradedFreeChargeRules(
  base: FreeChargeRules,
  upgrades: FreeChargeUpgrades,
): FreeChargeRules {
  const reduction = Math.min(Math.max(upgrades.intervalReductionPercent, 0), 90)
  return {
    maxCharges: base.maxCharges + Math.max(upgrades.extraCharges, 0),
    intervalSeconds: Math.max(1, Math.round((base.intervalSeconds * (100 - reduction)) / 100)),
  }
}

/** Multipliers are applied in hundredths (×1.25 → 125) so gem amounts stay exact integers. */
function hundredths(multiplier: number): number {
  return Math.max(0, Math.round(multiplier * 100))
}

/** Combined recycle factor in ten-thousandths: base rate × upgrade multiplier. */
export function recycleFactor(baseMultiplier: number, upgradeMultiplier: number): number {
  return hundredths(baseMultiplier) * hundredths(upgradeMultiplier)
}

/** Gems for one recycled copy: the rarity value times the factor, rounded half up. */
export function recycleValuePerCopy(rarityValue: number, factor: number): number {
  return Math.floor((rarityValue * factor + 5_000) / 10_000)
}
