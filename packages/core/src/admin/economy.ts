import { boosterTiers, rarities, settings, type Database, type Executor } from '@gachanime/db'
import {
  localizedTextSchema,
  parseSettingValue,
  settingsSchemas,
  type AdminBoosterTier,
  type AdminRarity,
  type AdminSettings,
  type SettingKey,
  type UpdateBoosterTierRequest,
  type UpdateRarityRequest,
} from '@gachanime/shared'
import { asc, eq, sql } from 'drizzle-orm'
import type { AdminActor } from '../catalog/admin-series'
import { AppError } from '../errors'
import { getSetting } from '../settings'
import { recordAdminAction } from './audit'

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getAdminSettings(db: Executor): Promise<AdminSettings> {
  return {
    'boosters.free': await getSetting(db, 'boosters.free'),
    'missions.reset': await getSetting(db, 'missions.reset'),
    'market.limits': await getSetting(db, 'market.limits'),
    'trades.offers': await getSetting(db, 'trades.offers'),
  }
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(settingsSchemas, key)
}

export async function updateSetting(
  database: Database,
  key: SettingKey,
  value: unknown,
  actor: AdminActor,
): Promise<void> {
  const parsed = parseSettingValue(key, value)
  await database.transaction(async (tx) => {
    const before = await getSetting(tx, key)
    await tx
      .insert(settings)
      .values({ key, value: parsed, updatedBy: actor.actorId })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: parsed, updatedBy: actor.actorId, updatedAt: new Date() },
      })
    await recordAdminAction(tx, {
      ...actor,
      action: 'setting.update',
      targetType: 'setting',
      targetId: key,
      before,
      after: parsed,
    })
  })
}

// ─── Rarities ────────────────────────────────────────────────────────────────

const rarityColumns = {
  key: rarities.key,
  sortOrder: rarities.sortOrder,
  name: rarities.name,
  colorToken: rarities.colorToken,
  favouritesThreshold: rarities.favouritesThreshold,
  recycleValue: rarities.recycleValue,
  marketMinPrice: rarities.marketMinPrice,
  marketMaxPrice: rarities.marketMaxPrice,
}

export async function listAdminRarities(db: Executor): Promise<AdminRarity[]> {
  const rows = await db.select(rarityColumns).from(rarities).orderBy(asc(rarities.sortOrder))
  return rows.map((row) => ({ ...row, name: localizedTextSchema.parse(row.name) }))
}

/**
 * Applies the favourites thresholds to every AniList character whose rarity was not set by hand
 * (ADR-015: highest threshold reached, else the lowest-threshold rarity). Returns how many
 * characters changed.
 */
export async function recomputeDefaultRarities(db: Executor): Promise<number> {
  const result = await db.execute(sql`
    UPDATE characters c SET rarity_id = target.id
    FROM (
      SELECT ch.id AS character_id, coalesce(
        (SELECT r.id FROM rarities r WHERE r.favourites_threshold <= coalesce(ch.favourites, 0)
          ORDER BY r.favourites_threshold DESC LIMIT 1),
        (SELECT r.id FROM rarities r ORDER BY r.favourites_threshold ASC LIMIT 1)) AS id
      FROM characters ch
      WHERE ch.source = 'anilist' AND NOT ch.rarity_overridden
    ) AS target
    WHERE c.id = target.character_id AND c.rarity_id IS DISTINCT FROM target.id`)
  return result.rowCount ?? 0
}

/**
 * Updates a rarity. Thresholds must stay strictly increasing with the rarity order, and a market
 * minimum cannot exceed the maximum. A threshold change re-applies default rarities.
 */
export async function updateRarity(
  database: Database,
  key: string,
  input: UpdateRarityRequest,
  actor: AdminActor,
): Promise<{ recomputedCharacters: number }> {
  return database.transaction(async (tx) => {
    // Lock every rarity: thresholds are checked against the others.
    const all = await tx
      .select(rarityColumns)
      .from(rarities)
      .orderBy(asc(rarities.sortOrder))
      .for('update')
    const before = all.find((rarity) => rarity.key === key)
    if (!before) throw new AppError('NOT_FOUND', `Rarity "${key}" not found`)
    const after = { ...before, ...input }

    const thresholds = all.map((rarity) =>
      rarity.key === key ? after.favouritesThreshold : rarity.favouritesThreshold,
    )
    if (thresholds.some((value, index) => index > 0 && value <= thresholds[index - 1]!)) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Favourites thresholds must increase strictly with the rarity order',
      )
    }
    if (after.marketMinPrice > after.marketMaxPrice) {
      throw new AppError('VALIDATION_FAILED', 'The market minimum exceeds the maximum')
    }

    await tx.update(rarities).set(input).where(eq(rarities.key, key))
    const recomputedCharacters =
      input.favouritesThreshold !== undefined &&
      input.favouritesThreshold !== before.favouritesThreshold
        ? await recomputeDefaultRarities(tx)
        : 0
    await recordAdminAction(tx, {
      ...actor,
      action: 'rarity.update',
      targetType: 'rarity',
      targetId: key,
      before: Object.fromEntries(
        Object.keys(input).map((field) => [field, before[field as keyof typeof before]]),
      ),
      after: { ...input, recomputedCharacters },
    })
    return { recomputedCharacters }
  })
}

// ─── Booster tiers ───────────────────────────────────────────────────────────

export async function listAdminBoosterTiers(db: Executor): Promise<AdminBoosterTier[]> {
  const rows = await db
    .select({
      key: boosterTiers.key,
      name: boosterTiers.name,
      description: boosterTiers.description,
      weights: boosterTiers.weights,
      priceGems: boosterTiers.priceGems,
      isActive: boosterTiers.isActive,
      sortOrder: boosterTiers.sortOrder,
      artToken: boosterTiers.artToken,
      openings: sql<number>`(SELECT count(*)::int FROM booster_openings bo
        WHERE bo.tier_id = "booster_tiers"."id")`,
    })
    .from(boosterTiers)
    .orderBy(asc(boosterTiers.sortOrder), asc(boosterTiers.id))
  return rows.map((row) => ({
    ...row,
    name: localizedTextSchema.parse(row.name),
    description: row.description ? localizedTextSchema.parse(row.description) : null,
  }))
}

/**
 * Updates a tier. Weights may only name configured rarities (Zod already checked the sum); the
 * free tier never gets a price (it uses free charges).
 */
export async function updateBoosterTier(
  database: Database,
  key: string,
  input: UpdateBoosterTierRequest,
  actor: AdminActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(boosterTiers)
      .where(eq(boosterTiers.key, key))
      .for('update')
    if (!before) throw new AppError('NOT_FOUND', `Booster tier "${key}" not found`)
    if (input.priceGems !== undefined && before.priceGems === null) {
      throw new AppError('VALIDATION_FAILED', 'The free tier has no price')
    }
    if (input.weights) {
      const known = new Set(
        (await tx.select({ key: rarities.key }).from(rarities)).map((r) => r.key),
      )
      const unknown = Object.keys(input.weights).filter((rarity) => !known.has(rarity))
      if (unknown.length > 0) {
        throw new AppError('VALIDATION_FAILED', `Unknown rarities: ${unknown.join(', ')}`)
      }
    }
    await tx.update(boosterTiers).set(input).where(eq(boosterTiers.key, key))
    await recordAdminAction(tx, {
      ...actor,
      action: 'booster_tier.update',
      targetType: 'booster_tier',
      targetId: key,
      before: Object.fromEntries(
        Object.keys(input).map((field) => [field, before[field as keyof typeof before]]),
      ),
      after: input,
    })
  })
}
