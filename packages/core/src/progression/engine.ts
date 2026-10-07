import {
  achievements,
  missions,
  userAchievements,
  userCounters,
  userMissionDedup,
  userMissions,
  type Executor,
} from '@gachanime/db'
import {
  counterIncrements,
  eventAmount,
  eventSubject,
  matchesFilter,
  metricsAffectedBy,
  ONCE_PERIOD_KEY,
  periodKey,
  type GameEvent,
  type MetricKey,
} from '@gachanime/game'
import {
  localizedTextSchema,
  type CompletedObjective,
  type ProgressionUpdate,
} from '@gachanime/shared'
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { getSetting } from '../settings'
import { computeMetricValues } from './metrics'

/**
 * Progression engine (ADR-010). Services call it inside their transaction with the events of an
 * action: counters, missions of the current period and affected achievements are updated in the
 * same transaction. Returns the objectives the action completed (toasts).
 */
export async function emitEvents(
  tx: Executor,
  userId: string,
  events: GameEvent[],
  now = new Date(),
): Promise<ProgressionUpdate> {
  if (events.length === 0) return { completed: [] }
  await incrementCounters(tx, userId, events)
  const completed = [
    ...(await advanceMissions(tx, userId, events, now)),
    ...(await refreshAchievements(
      tx,
      userId,
      metricsAffectedBy(events.map((event) => event.type)),
      now,
    )),
  ]
  return { completed }
}

async function incrementCounters(tx: Executor, userId: string, events: GameEvent[]) {
  const totals = new Map<string, number>()
  for (const event of events) {
    for (const [key, value] of Object.entries(counterIncrements(event))) {
      totals.set(key, (totals.get(key) ?? 0) + value)
    }
  }
  if (totals.size === 0) return
  await tx
    .insert(userCounters)
    .values([...totals].map(([key, value]) => ({ userId, key, value })))
    .onConflictDoUpdate({
      target: [userCounters.userId, userCounters.key],
      set: { value: sql`${userCounters.value} + excluded.value` },
    })
}

async function advanceMissions(
  tx: Executor,
  userId: string,
  events: GameEvent[],
  now: Date,
): Promise<CompletedObjective[]> {
  const types = [...new Set(events.map((event) => event.type))]
  const active = await tx
    .select()
    .from(missions)
    .where(and(eq(missions.isActive, true), inArray(missions.eventType, types)))
  if (active.length === 0) return []
  const dailyKey = periodKey(now, await getSetting(tx, 'missions.reset'))

  const completed: CompletedObjective[] = []
  for (const mission of active) {
    const key = mission.kind === 'daily' ? dailyKey : ONCE_PERIOD_KEY
    let amount = 0
    for (const event of events) {
      if (event.type !== mission.eventType || !matchesFilter(event, mission.filter)) continue
      const subject = eventSubject(event)
      if (subject) {
        const inserted = await tx
          .insert(userMissionDedup)
          .values({ userId, missionId: mission.id, periodKey: key, subjectId: subject })
          .onConflictDoNothing()
          .returning({ subjectId: userMissionDedup.subjectId })
        if (inserted.length === 0) continue
      }
      amount += eventAmount(event)
    }
    if (amount === 0) continue

    const [previous] = await tx
      .select({ completedAt: userMissions.completedAt })
      .from(userMissions)
      .where(
        and(
          eq(userMissions.userId, userId),
          eq(userMissions.missionId, mission.id),
          eq(userMissions.periodKey, key),
        ),
      )
      .for('update')
    const progress = sql`LEAST(${mission.target}, ${userMissions.progress} + excluded.progress)`
    const [row] = await tx
      .insert(userMissions)
      .values({
        userId,
        missionId: mission.id,
        periodKey: key,
        progress: Math.min(mission.target, amount),
        completedAt: amount >= mission.target ? now : null,
      })
      .onConflictDoUpdate({
        target: [userMissions.userId, userMissions.missionId, userMissions.periodKey],
        set: {
          progress,
          completedAt: sql`CASE WHEN ${userMissions.completedAt} IS NULL AND ${progress} >= ${mission.target}
            THEN ${now.toISOString()}::timestamptz ELSE ${userMissions.completedAt} END`,
        },
      })
      .returning({ completedAt: userMissions.completedAt })
    if (row?.completedAt && !previous?.completedAt) {
      completed.push({
        kind: 'mission',
        id: mission.id,
        name: localizedTextSchema.parse(mission.name),
        rewardGems: mission.rewardGems,
      })
    }
  }
  return completed
}

/**
 * Recomputes the progress of the player's incomplete active achievements on these metrics (all
 * metrics when `metrics` is null). Completion is sticky: never cleared once set.
 */
export async function refreshAchievements(
  tx: Executor,
  userId: string,
  metrics: Set<MetricKey> | null,
  now = new Date(),
): Promise<CompletedObjective[]> {
  if (metrics && metrics.size === 0) return []
  const conditions = [
    eq(achievements.isActive, true),
    or(isNull(userAchievements.completedAt), isNull(userAchievements.userId))!,
  ]
  if (metrics) conditions.push(inArray(achievements.metric, [...metrics]))
  const pending = await tx
    .select({
      id: achievements.id,
      metric: achievements.metric,
      params: achievements.params,
      target: achievements.target,
      name: achievements.name,
      rewardGems: achievements.rewardGems,
      progress: userAchievements.progress,
    })
    .from(achievements)
    .leftJoin(
      userAchievements,
      and(eq(userAchievements.achievementId, achievements.id), eq(userAchievements.userId, userId)),
    )
    .where(and(...conditions))
  if (pending.length === 0) return []

  const values = await computeMetricValues(tx, userId, pending)
  const completed: CompletedObjective[] = []
  const rows = pending
    .map((achievement) => {
      const value = values.get(achievement.id) ?? 0
      const done = value >= achievement.target
      if (done) {
        completed.push({
          kind: 'achievement',
          id: achievement.id,
          name: localizedTextSchema.parse(achievement.name),
          rewardGems: achievement.rewardGems,
        })
      }
      return { achievement, value, done }
    })
    // Untouched rows (no change, not new) are skipped.
    .filter(({ achievement, value, done }) => done || value !== (achievement.progress ?? -1))

  if (rows.length > 0) {
    await tx
      .insert(userAchievements)
      .values(
        rows.map(({ achievement, value, done }) => ({
          userId,
          achievementId: achievement.id,
          progress: Math.min(value, achievement.target),
          completedAt: done ? now : null,
        })),
      )
      .onConflictDoUpdate({
        target: [userAchievements.userId, userAchievements.achievementId],
        set: {
          progress: sql`CASE WHEN ${userAchievements.completedAt} IS NULL THEN excluded.progress
            ELSE ${userAchievements.progress} END`,
          completedAt: sql`coalesce(${userAchievements.completedAt}, excluded.completed_at)`,
        },
      })
  }
  return completed
}
