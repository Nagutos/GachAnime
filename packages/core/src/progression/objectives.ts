import {
  achievements,
  missions,
  trades,
  userAchievements,
  userMissions,
  type Database,
  type Executor,
} from '@gachanime/db'
import { nextResetAt, ONCE_PERIOD_KEY, periodKey } from '@gachanime/game'
import {
  localizedTextSchema,
  type AchievementDto,
  type AchievementsResponse,
  type ClaimMissionRequest,
  type ClaimResult,
  type MissionDto,
  type MissionsResponse,
  type ProgressionSummary,
} from '@gachanime/shared'
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { AppError } from '../errors'
import { changeGems, lockPlayer } from '../players/gems'
import { getSetting } from '../settings'
import { refreshAchievements } from './engine'

const text = (value: unknown) => localizedTextSchema.parse(value)
const optionalText = (value: unknown) => (value ? localizedTextSchema.parse(value) : null)

/** Active missions with the player's progress for the current period. */
export async function listMissions(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<MissionsResponse> {
  const reset = await getSetting(db, 'missions.reset')
  const dailyKey = periodKey(now, reset)
  const rows = await db
    .select({
      mission: missions,
      progress: userMissions.progress,
      completedAt: userMissions.completedAt,
      claimedAt: userMissions.claimedAt,
    })
    .from(missions)
    .leftJoin(
      userMissions,
      and(
        eq(userMissions.missionId, missions.id),
        eq(userMissions.userId, userId),
        sql`${userMissions.periodKey} = CASE WHEN ${missions.kind} = 'daily' THEN ${dailyKey} ELSE ${ONCE_PERIOD_KEY} END`,
      ),
    )
    .where(eq(missions.isActive, true))
    .orderBy(asc(missions.sortOrder), asc(missions.id))

  const items: MissionDto[] = rows.map((row) => ({
    id: row.mission.id,
    key: row.mission.key,
    name: text(row.mission.name),
    description: optionalText(row.mission.description),
    kind: row.mission.kind,
    target: row.mission.target,
    rewardGems: row.mission.rewardGems,
    progress: row.progress ?? 0,
    periodKey: row.mission.kind === 'daily' ? dailyKey : ONCE_PERIOD_KEY,
    completed: Boolean(row.completedAt),
    claimed: Boolean(row.claimedAt),
  }))
  return {
    daily: items.filter((item) => item.kind === 'daily'),
    // Claimed one-time missions disappear.
    once: items.filter((item) => item.kind === 'once' && !item.claimed),
    periodKey: dailyKey,
    nextResetAt: nextResetAt(now, reset).toISOString(),
    serverTime: now.toISOString(),
  }
}

/** Claims a completed mission reward (gems only). A past day's completed mission stays claimable. */
export async function claimMission(
  database: Database,
  userId: string,
  input: ClaimMissionRequest,
  now = new Date(),
): Promise<ClaimResult> {
  return database.transaction(async (tx) => {
    await lockPlayer(tx, userId)
    const [claimed] = await tx
      .update(userMissions)
      .set({ claimedAt: now })
      .where(
        and(
          eq(userMissions.userId, userId),
          eq(userMissions.missionId, input.missionId),
          eq(userMissions.periodKey, input.periodKey),
          isNotNull(userMissions.completedAt),
          isNull(userMissions.claimedAt),
        ),
      )
      .returning({ missionId: userMissions.missionId })
    if (!claimed) throw new AppError('NOT_CLAIMABLE', 'This mission reward cannot be claimed')
    const [mission] = await tx
      .select({ rewardGems: missions.rewardGems })
      .from(missions)
      .where(eq(missions.id, input.missionId))
    const rewardGems = mission?.rewardGems ?? 0
    const gemBalance =
      rewardGems > 0
        ? await changeGems(tx, {
            userId,
            amount: rewardGems,
            reason: 'mission_reward',
            refType: 'mission',
            refId: `${input.missionId}:${input.periodKey}`,
          })
        : (await lockPlayer(tx, userId)).gemBalance
    return { rewardGems, gemBalance }
  })
}

/**
 * Active achievements with the player's progress. Progress is refreshed first, so it is right
 * even after catalog changes or for players who played before an achievement existed.
 */
export async function listAchievements(
  database: Database,
  userId: string,
  status: 'all' | 'todo' | 'completed',
): Promise<AchievementsResponse> {
  return database.transaction(async (tx) => {
    await refreshAchievements(tx, userId, null)
    const rows = await tx
      .select({
        achievement: achievements,
        progress: userAchievements.progress,
        completedAt: userAchievements.completedAt,
        claimedAt: userAchievements.claimedAt,
      })
      .from(achievements)
      .leftJoin(
        userAchievements,
        and(
          eq(userAchievements.achievementId, achievements.id),
          eq(userAchievements.userId, userId),
        ),
      )
      .where(eq(achievements.isActive, true))
      .orderBy(asc(achievements.sortOrder), asc(achievements.id))

    const all: AchievementDto[] = rows.map((row) => ({
      id: row.achievement.id,
      key: row.achievement.key,
      name: text(row.achievement.name),
      description: optionalText(row.achievement.description),
      metric: row.achievement.metric as AchievementDto['metric'],
      target: row.achievement.target,
      rewardGems: row.achievement.rewardGems,
      iconToken: row.achievement.iconToken,
      progress: row.completedAt
        ? row.achievement.target
        : Math.min(row.progress ?? 0, row.achievement.target),
      completedAt: row.completedAt?.toISOString() ?? null,
      claimedAt: row.claimedAt?.toISOString() ?? null,
    }))
    const items =
      status === 'all'
        ? all
        : all.filter((item) => (status === 'completed') === Boolean(item.completedAt))
    return {
      items,
      completed: all.filter((item) => item.completedAt).length,
      total: all.length,
    }
  })
}

export async function claimAchievement(
  database: Database,
  userId: string,
  achievementId: number,
  now = new Date(),
): Promise<ClaimResult> {
  return database.transaction(async (tx) => {
    await lockPlayer(tx, userId)
    const [claimed] = await tx
      .update(userAchievements)
      .set({ claimedAt: now })
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId),
          isNotNull(userAchievements.completedAt),
          isNull(userAchievements.claimedAt),
        ),
      )
      .returning({ achievementId: userAchievements.achievementId })
    if (!claimed) throw new AppError('NOT_CLAIMABLE', 'This achievement reward cannot be claimed')
    const [achievement] = await tx
      .select({ rewardGems: achievements.rewardGems })
      .from(achievements)
      .where(eq(achievements.id, achievementId))
    const rewardGems = achievement?.rewardGems ?? 0
    const gemBalance =
      rewardGems > 0
        ? await changeGems(tx, {
            userId,
            amount: rewardGems,
            reason: 'achievement_reward',
            refType: 'achievement',
            refId: achievementId,
          })
        : (await lockPlayer(tx, userId)).gemBalance
    return { rewardGems, gemBalance }
  })
}

/** Rewards waiting to be claimed: current daily period, once missions and achievements. */
export async function getProgressionSummary(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<ProgressionSummary> {
  const dailyKey = periodKey(now, await getSetting(db, 'missions.reset'))
  const [missionRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(userMissions)
    .innerJoin(missions, eq(missions.id, userMissions.missionId))
    .where(
      and(
        eq(userMissions.userId, userId),
        eq(missions.isActive, true),
        isNotNull(userMissions.completedAt),
        isNull(userMissions.claimedAt),
        sql`${userMissions.periodKey} IN (${dailyKey}, ${ONCE_PERIOD_KEY})`,
      ),
    )
  const [achievementRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .where(
      and(
        eq(userAchievements.userId, userId),
        eq(achievements.isActive, true),
        isNotNull(userAchievements.completedAt),
        isNull(userAchievements.claimedAt),
      ),
    )
  const [tradeRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(trades)
    .where(
      and(
        eq(trades.recipientId, userId),
        eq(trades.status, 'pending'),
        sql`(${trades.expiresAt} IS NULL OR ${trades.expiresAt} > ${now.toISOString()}::timestamptz)`,
      ),
    )
  return {
    claimableMissions: missionRow?.value ?? 0,
    claimableAchievements: achievementRow?.value ?? 0,
    pendingTrades: tradeRow?.value ?? 0,
  }
}
