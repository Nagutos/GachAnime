import { playerProfiles, playerUpgrades, type Database, type Executor } from '@gachanime/db'
import {
  rebaseFreeCharges,
  recycleFactor,
  upgradedFreeChargeRules,
  upgradeValue,
  type FreeChargeRules,
  type UpgradeLevel,
} from '@gachanime/game'
import {
  UPGRADE_KEYS,
  UPGRADE_SETTING_KEYS,
  type BuyUpgradeRequest,
  type UpgradeKey,
  type UpgradesResponse,
} from '@gachanime/shared'
import { eq, sql } from 'drizzle-orm'
import { toFreeStatus } from '../boosters/free-status'
import { AppError } from '../errors'
import { getSetting } from '../settings'
import { changeGems, lockPlayer } from './gems'

export type UpgradeLevels = Record<UpgradeKey, number>

export async function loadUpgradeLevels(db: Executor, userId: string): Promise<UpgradeLevels> {
  const rows = await db
    .select({ key: playerUpgrades.key, level: playerUpgrades.level })
    .from(playerUpgrades)
    .where(eq(playerUpgrades.userId, userId))
  const levels = Object.fromEntries(UPGRADE_KEYS.map((key) => [key, 0])) as UpgradeLevels
  for (const row of rows) levels[row.key] = row.level
  return levels
}

async function loadUpgradeConfig(db: Executor, key: UpgradeKey): Promise<UpgradeLevel[]> {
  return (await getSetting(db, UPGRADE_SETTING_KEYS[key])).levels
}

async function freeRulesFor(db: Executor, levels: UpgradeLevels): Promise<FreeChargeRules> {
  const base = await getSetting(db, 'boosters.free')
  const storage = await loadUpgradeConfig(db, 'booster_storage')
  const speed = await loadUpgradeConfig(db, 'booster_speed')
  return upgradedFreeChargeRules(base, {
    extraCharges: upgradeValue(storage, levels.booster_storage) ?? 0,
    intervalReductionPercent: upgradeValue(speed, levels.booster_speed) ?? 0,
  })
}

async function recycleFactorFor(db: Executor, levels: UpgradeLevels): Promise<number> {
  const { multiplier } = await getSetting(db, 'recycle')
  const bonus = await loadUpgradeConfig(db, 'recycle_bonus')
  return recycleFactor(multiplier, upgradeValue(bonus, levels.recycle_bonus) ?? 1)
}

/** Free booster rules of one player: the instance settings with their upgrades applied. */
export async function getPlayerFreeRules(db: Executor, userId: string): Promise<FreeChargeRules> {
  return freeRulesFor(db, await loadUpgradeLevels(db, userId))
}

/** Recycle factor of one player, in ten-thousandths (see `recycleValuePerCopy`). */
export async function getPlayerRecycleFactor(db: Executor, userId: string): Promise<number> {
  return recycleFactorFor(db, await loadUpgradeLevels(db, userId))
}

export async function listUpgrades(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<UpgradesResponse> {
  const [profile] = await db
    .select({ gemBalance: playerProfiles.gemBalance, anchor: playerProfiles.freeBoosterAnchorAt })
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
  if (!profile) throw new AppError('NOT_FOUND', 'Player profile not found')
  const levels = await loadUpgradeLevels(db, userId)
  const upgrades: UpgradesResponse['upgrades'] = []
  for (const key of UPGRADE_KEYS) {
    const config = await loadUpgradeConfig(db, key)
    const level = levels[key]
    const next = config[level]
    upgrades.push({
      key,
      level,
      maxLevel: config.length,
      value: upgradeValue(config, level),
      next: next ? { level: level + 1, cost: next.cost, value: next.value } : null,
    })
  }
  return {
    upgrades,
    gemBalance: profile.gemBalance,
    free: toFreeStatus(profile.anchor, now, await freeRulesFor(db, levels)),
    recycleMultiplier: (await recycleFactorFor(db, levels)) / 10_000,
  }
}

/**
 * Buys the next level of an upgrade, in one transaction: gems debited with a ledger row, level
 * raised. A free booster upgrade rebases the timer anchor so the player keeps their charges and
 * progress instead of getting a refill.
 */
export async function buyUpgrade(
  database: Database,
  userId: string,
  key: UpgradeKey,
  input: BuyUpgradeRequest,
  now = new Date(),
): Promise<UpgradesResponse> {
  return database.transaction(async (tx) => {
    const player = await lockPlayer(tx, userId)
    const levels = await loadUpgradeLevels(tx, userId)
    const current = levels[key]
    if (input.level !== current + 1) {
      throw new AppError('UPGRADE_LEVEL_CHANGED', 'The upgrade level changed', { level: current })
    }
    const next = (await loadUpgradeConfig(tx, key))[current]
    if (!next) throw new AppError('UPGRADE_UNAVAILABLE', `No further level for "${key}"`)

    if (player.gemBalance < next.cost) {
      throw new AppError('NOT_ENOUGH_GEMS', 'Not enough gems', { required: next.cost })
    }
    if (next.cost > 0) {
      await changeGems(tx, {
        userId,
        amount: -next.cost,
        reason: 'upgrade_purchase',
        refType: 'upgrade',
        refId: `${key}:${input.level}`,
      })
    }

    const after = { ...levels, [key]: input.level }
    await tx
      .insert(playerUpgrades)
      .values({ userId, key, level: input.level })
      .onConflictDoUpdate({
        target: [playerUpgrades.userId, playerUpgrades.key],
        set: { level: sql`excluded.level` },
      })

    if (key === 'booster_storage' || key === 'booster_speed') {
      const anchor = rebaseFreeCharges(
        player.freeBoosterAnchorAt,
        now,
        await freeRulesFor(tx, levels),
        await freeRulesFor(tx, after),
      )
      await tx
        .update(playerProfiles)
        .set({ freeBoosterAnchorAt: anchor })
        .where(eq(playerProfiles.userId, userId))
    }
    return listUpgrades(tx, userId, now)
  })
}
