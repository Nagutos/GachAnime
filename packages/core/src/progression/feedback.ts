import { feedback, playerProfiles, users, type Database, type Executor } from '@gachanime/db'
import type { AdminFeedbackList, FeedbackRequest, ProgressionUpdate } from '@gachanime/shared'
import { count, desc, eq, sql } from 'drizzle-orm'
import { lockPlayer } from '../players/gems'
import { emitEvents } from './engine'

type FeedbackRow = typeof feedback.$inferSelect

function toDto(row: FeedbackRow) {
  return {
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getMyFeedback(db: Executor, userId: string) {
  const [row] = await db.select().from(feedback).where(eq(feedback.userId, userId))
  return { feedback: row ? toDto(row) : null }
}

/** One feedback per player, editable; only the first submission emits `feedback_submitted`. */
export async function submitFeedback(
  database: Database,
  userId: string,
  input: FeedbackRequest,
): Promise<{ feedback: ReturnType<typeof toDto>; progression: ProgressionUpdate }> {
  return database.transaction(async (tx) => {
    // The profile lock serializes concurrent first submissions.
    await lockPlayer(tx, userId)
    const [existing] = await tx
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.userId, userId))
    const [row] = await tx
      .insert(feedback)
      .values({ userId, rating: input.rating, comment: input.comment })
      .onConflictDoUpdate({
        target: feedback.userId,
        set: { rating: input.rating, comment: input.comment, updatedAt: new Date() },
      })
      .returning()
    const progression = !existing
      ? await emitEvents(tx, userId, [{ type: 'feedback_submitted' }])
      : { completed: [] }
    return { feedback: toDto(row!), progression }
  })
}

export async function listFeedback(
  db: Executor,
  query: { page: number; pageSize: number },
): Promise<AdminFeedbackList> {
  const [rows, [stats], distribution] = await Promise.all([
    db
      .select({
        row: feedback,
        username: playerProfiles.username,
        displayName: users.name,
      })
      .from(feedback)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, feedback.userId))
      .innerJoin(users, eq(users.id, feedback.userId))
      .orderBy(desc(feedback.updatedAt), desc(feedback.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count(), average: sql<number | null>`avg(${feedback.rating})::float` })
      .from(feedback),
    db.select({ rating: feedback.rating, value: count() }).from(feedback).groupBy(feedback.rating),
  ])
  const counts = [0, 0, 0, 0, 0]
  for (const row of distribution) counts[row.rating - 1] = row.value
  return {
    items: rows.map(({ row, username, displayName }) => ({
      ...toDto(row),
      id: row.id,
      userId: row.userId,
      username,
      displayName,
    })),
    total: stats?.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    average: stats?.average ?? null,
    distribution: counts,
  }
}
