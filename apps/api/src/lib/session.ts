import { AppError, getUserAccess } from '@gachanime/core'
import { getAuth } from './auth'
import { getDb } from './db'

export interface SessionUser {
  id: string
  role: 'user' | 'admin'
}

/**
 * Signed-in user, with the role and ban state read from the database: the session cached in
 * Redis keeps the user as it was at sign-in (e.g. before an `ADMIN_DISCORD_IDS` promotion, which
 * runs right after the session is created, or an `admin:promote`).
 */
export async function requireUser(request: Request): Promise<SessionUser> {
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session) throw new AppError('UNAUTHENTICATED', 'Sign in required')
  const access = await getUserAccess(getDb(), session.user.id)
  if (!access) throw new AppError('UNAUTHENTICATED', 'Sign in required')
  if (access.banned) throw new AppError('PLAYER_BANNED', 'This account is banned')
  return { id: session.user.id, role: access.role }
}

/** Every admin route handler must call this: the role is always checked server-side. */
export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await requireUser(request)
  if (user.role !== 'admin') throw new AppError('FORBIDDEN', 'Admin role required')
  return user
}
