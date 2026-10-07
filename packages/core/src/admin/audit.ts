import { adminAuditLog, type Executor } from '@gachanime/db'

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
