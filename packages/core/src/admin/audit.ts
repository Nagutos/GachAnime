import { adminAuditLog, users, type Executor } from '@gachanime/db'
import type { AuditLogEntry, Paginated } from '@gachanime/shared'
import { count, desc, eq } from 'drizzle-orm'

export interface AdminActionInput {
  /** Null when the action comes from the CLI or the environment bootstrap. */
  actorId: string | null
  action: string
  targetType: string
  targetId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
}

/** Writes one audit row. Call it in the same transaction as the change it describes. */
export async function recordAdminAction(db: Executor, input: AdminActionInput): Promise<void> {
  await db.insert(adminAuditLog).values({
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    ip: input.ip ?? null,
  })
}

/** Paginated audit log, newest first, optionally filtered by target type. */
export async function listAdminActions(
  db: Executor,
  query: { page: number; pageSize: number; targetType?: string },
): Promise<Paginated<AuditLogEntry>> {
  const where = query.targetType ? eq(adminAuditLog.targetType, query.targetType) : undefined
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: adminAuditLog.id,
        actorId: adminAuditLog.actorId,
        actorName: users.name,
        action: adminAuditLog.action,
        targetType: adminAuditLog.targetType,
        targetId: adminAuditLog.targetId,
        before: adminAuditLog.before,
        after: adminAuditLog.after,
        createdAt: adminAuditLog.createdAt,
      })
      .from(adminAuditLog)
      .leftJoin(users, eq(users.id, adminAuditLog.actorId))
      .where(where)
      .orderBy(desc(adminAuditLog.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(adminAuditLog).where(where),
  ])
  return {
    items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}
