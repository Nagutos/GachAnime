import { AppError, getAdminUser, recordAdminAction } from '@gachanime/core'
import { updateAdminUserSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { setUserBan, setUserRole } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

/**
 * Role and ban changes go through Better Auth's internal adapter (a ban revokes the user's
 * sessions), then are written to the audit log.
 */
export const PATCH = adminRoute<{ id: string }>(async ({ request, actor, params }) => {
  const body = await parseJsonBody(request, updateAdminUserSchema)
  if (params.id === actor.actorId && (body.banned || body.role === 'user')) {
    throw new AppError('FORBIDDEN', 'You cannot ban or demote yourself')
  }
  const db = getDb()
  const before = await getAdminUser(db, params.id)
  if (body.role && body.role !== before.role) await setUserRole(params.id, body.role)
  if (body.banned === true && !before.banned) {
    await setUserBan(params.id, { banned: true, reason: body.banReason ?? null })
  } else if (body.banned === false && before.banned) {
    await setUserBan(params.id, { banned: false })
  }
  const after = await getAdminUser(db, params.id)
  await recordAdminAction(db, {
    ...actor,
    action: 'user.update',
    targetType: 'user',
    targetId: params.id,
    before: { role: before.role, banned: before.banned, banReason: before.banReason },
    after: { role: after.role, banned: after.banned, banReason: after.banReason },
  })
  return Response.json(after)
})
