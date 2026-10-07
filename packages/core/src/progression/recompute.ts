import { achievements, playerProfiles, type Database } from '@gachanime/db'
import { METRICS, METRIC_KEYS, type MetricKey } from '@gachanime/game'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { refreshAchievements } from './engine'

const STATE_METRICS = new Set<MetricKey>(METRIC_KEYS.filter((key) => METRICS[key].kind === 'state'))

/**
 * After a catalog change (series or characters toggled, import…), recomputes the state metrics
 * of every player with an incomplete achievement on them (worker job). Completion stays sticky.
 */
export async function recomputeStateAchievementsForAll(
  database: Database,
): Promise<{ players: number; completed: number }> {
  const stateAchievements = await database
    .select({ id: achievements.id })
    .from(achievements)
    .where(and(eq(achievements.isActive, true), inArray(achievements.metric, [...STATE_METRICS])))
  if (stateAchievements.length === 0) return { players: 0, completed: 0 }

  // Players missing at least one of these achievements.
  const players = await database
    .select({ userId: playerProfiles.userId })
    .from(playerProfiles)
    .where(
      sql`EXISTS (SELECT 1 FROM achievements a
        LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ${playerProfiles.userId}
        WHERE a.is_active AND a.metric IN (${sql.join(
          [...STATE_METRICS].map((metric) => sql`${metric}`),
          sql`, `,
        )}) AND ua.completed_at IS NULL)`,
    )
  let completed = 0
  for (const player of players) {
    await database.transaction(async (tx) => {
      completed += (await refreshAchievements(tx, player.userId, STATE_METRICS)).length
    })
  }
  return { players: players.length, completed }
}
