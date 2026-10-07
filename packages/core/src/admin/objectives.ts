import { achievements, missions, type Database, type Executor } from '@gachanime/db'
import { isMetricKey, METRICS } from '@gachanime/game'
import {
  localizedTextSchema,
  type AdminAchievement,
  type AdminMission,
  type CreateAchievementRequest,
  type CreateMissionRequest,
  type UpdateAchievementRequest,
  type UpdateMissionRequest,
} from '@gachanime/shared'
import { asc, eq, sql } from 'drizzle-orm'
import type { AdminActor } from '../catalog/admin-series'
import { AppError } from '../errors'
import { recordAdminAction } from './audit'

const optionalText = (value: unknown) => (value ? localizedTextSchema.parse(value) : null)

// ─── Missions ────────────────────────────────────────────────────────────────

export async function listAdminMissions(db: Executor): Promise<AdminMission[]> {
  const rows = await db.select().from(missions).orderBy(asc(missions.sortOrder), asc(missions.id))
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    name: localizedTextSchema.parse(row.name),
    description: optionalText(row.description),
    kind: row.kind,
    eventType: row.eventType as AdminMission['eventType'],
    filter: (row.filter as AdminMission['filter']) ?? null,
    target: row.target,
    rewardGems: row.rewardGems,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }))
}

export async function createMission(
  database: Database,
  input: CreateMissionRequest,
  actor: AdminActor,
): Promise<{ id: number }> {
  return database.transaction(async (tx) => {
    const [created] = await tx
      .insert(missions)
      .values({ ...input, description: input.description ?? null, filter: input.filter ?? null })
      .onConflictDoNothing()
      .returning()
    if (!created) throw new AppError('CONFLICT', `Mission "${input.key}" already exists`)
    await recordAdminAction(tx, {
      ...actor,
      action: 'mission.create',
      targetType: 'mission',
      targetId: String(created.id),
      after: created,
    })
    return { id: created.id }
  })
}

/**
 * Updates a mission. Changing the event type, filter or target applies to future progress only;
 * deactivate a mission instead of deleting it to keep players' history.
 */
export async function updateMission(
  database: Database,
  id: number,
  input: UpdateMissionRequest,
  actor: AdminActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [before] = await tx.select().from(missions).where(eq(missions.id, id)).for('update')
    if (!before) throw new AppError('NOT_FOUND', `Mission #${id} not found`)
    const [after] = await tx.update(missions).set(input).where(eq(missions.id, id)).returning()
    await recordAdminAction(tx, {
      ...actor,
      action: 'mission.update',
      targetType: 'mission',
      targetId: String(id),
      before,
      after,
    })
  })
}

// ─── Achievements ────────────────────────────────────────────────────────────

function validateMetric(metric: string, params: Record<string, unknown>): Record<string, unknown> {
  if (!isMetricKey(metric)) throw new AppError('VALIDATION_FAILED', `Unknown metric "${metric}"`)
  const parsed = METRICS[metric].params.safeParse(params)
  if (!parsed.success) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Invalid parameters for "${metric}"`,
      parsed.error.issues,
    )
  }
  return parsed.data
}

export async function listAdminAchievements(db: Executor): Promise<AdminAchievement[]> {
  const rows = await db
    .select({
      row: achievements,
      completions: sql<number>`(SELECT count(*)::int FROM user_achievements ua
        WHERE ua.achievement_id = "achievements"."id" AND ua.completed_at IS NOT NULL)`,
    })
    .from(achievements)
    .orderBy(asc(achievements.sortOrder), asc(achievements.id))
  return rows.map(({ row, completions }) => ({
    id: row.id,
    key: row.key,
    name: localizedTextSchema.parse(row.name),
    description: optionalText(row.description),
    metric: row.metric as AdminAchievement['metric'],
    params: row.params,
    target: row.target,
    rewardGems: row.rewardGems,
    iconToken: row.iconToken,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    completions,
  }))
}

export async function createAchievement(
  database: Database,
  input: CreateAchievementRequest,
  actor: AdminActor,
): Promise<{ id: number }> {
  const params = validateMetric(input.metric, input.params)
  return database.transaction(async (tx) => {
    const [created] = await tx
      .insert(achievements)
      .values({ ...input, params, description: input.description ?? null })
      .onConflictDoNothing()
      .returning()
    if (!created) throw new AppError('CONFLICT', `Achievement "${input.key}" already exists`)
    await recordAdminAction(tx, {
      ...actor,
      action: 'achievement.create',
      targetType: 'achievement',
      targetId: String(created.id),
      after: created,
    })
    return { id: created.id }
  })
}

/** Completion stays sticky: lowering or raising a target never revokes a completed achievement. */
export async function updateAchievement(
  database: Database,
  id: number,
  input: UpdateAchievementRequest,
  actor: AdminActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(achievements)
      .where(eq(achievements.id, id))
      .for('update')
    if (!before) throw new AppError('NOT_FOUND', `Achievement #${id} not found`)
    const changes = { ...input }
    if (input.metric !== undefined || input.params !== undefined) {
      changes.params = validateMetric(input.metric ?? before.metric, input.params ?? before.params)
    }
    const [after] = await tx
      .update(achievements)
      .set(changes)
      .where(eq(achievements.id, id))
      .returning()
    await recordAdminAction(tx, {
      ...actor,
      action: 'achievement.update',
      targetType: 'achievement',
      targetId: String(id),
      before,
      after,
    })
  })
}
