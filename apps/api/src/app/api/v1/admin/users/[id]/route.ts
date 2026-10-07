import { AppError, getAdminUser, recordAdminAction } from '@gachanime/core'
import { updateAdminUserSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

/**
 * Role and ban changes go through Better Auth's admin plugin (it also revokes the sessions of a
 * banned user), then are written to the audit log.
 */
export const PATCH = adminRoute<{ id: string }>(async ({ request, actor, params }) => {
  const body = await parseJsonBody(request, updateAdminUserSchema)
  if (params.id === actor.actorId && (body.banned || body.role === 'user')) {
    throw new AppError('FORBIDDEN', 'You cannot ban or demote yourself')
  }
  const db = getDb()
  const before = await getAdminUser(db, params.id)
  const auth = getAuth()
  const headers = request.headers
  if (body.role && body.role !== before.role) {
    await auth.api.setRole({ body: { userId: params.id, role: body.role }, headers })
  }
  if (body.banned === true && !before.banned) {
    await auth.api.banUser({
      body: { userId: params.id, banReason: body.banReason ?? undefined },
      headers,
    })
  } else if (body.banned === false && before.banned) {
    await auth.api.unbanUser({ body: { userId: params.id }, headers })
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
