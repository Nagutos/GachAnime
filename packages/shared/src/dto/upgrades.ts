import { z } from 'zod'
import { freeBoosterStatusSchema } from './player'

/** Player upgrades bought with gems (GAME_DESIGN §9), in display order. */
export const UPGRADE_KEYS = ['booster_storage', 'booster_speed', 'recycle_bonus'] as const
export const upgradeKeySchema = z.enum(UPGRADE_KEYS)
export type UpgradeKey = z.infer<typeof upgradeKeySchema>

/** Setting holding the levels of each upgrade. */
export const UPGRADE_SETTING_KEYS = {
  booster_storage: 'upgrades.boosterStorage',
  booster_speed: 'upgrades.boosterSpeed',
  recycle_bonus: 'upgrades.recycleBonus',
} as const satisfies Record<UpgradeKey, string>

/**
 * Values by upgrade: booster_storage = extra free charges, booster_speed = interval reduction in
 * %, recycle_bonus = recycle multiplier.
 */
export const upgradeDtoSchema = z.object({
  key: upgradeKeySchema,
  level: z.number().int().nonnegative(),
  maxLevel: z.number().int().nonnegative(),
  /** Effect of the current level; null when not bought. */
  value: z.number().nullable(),
  /** Null at the maximum level. */
  next: z
    .object({ level: z.number().int().positive(), cost: z.number().int(), value: z.number() })
    .nullable(),
})
export type UpgradeDto = z.infer<typeof upgradeDtoSchema>

export const upgradesResponseSchema = z.object({
  upgrades: z.array(upgradeDtoSchema),
  gemBalance: z.number().int().nonnegative(),
  /** Free boosters with the upgrades applied. */
  free: freeBoosterStatusSchema,
  /** Base recycle multiplier × recycle upgrade. */
  recycleMultiplier: z.number().nonnegative(),
})
export type UpgradesResponse = z.infer<typeof upgradesResponseSchema>

/** `level` is the level being bought: a repeated click cannot buy two levels. */
export const buyUpgradeRequestSchema = z.object({ level: z.number().int().min(1).max(100) })
export type BuyUpgradeRequest = z.infer<typeof buyUpgradeRequestSchema>
