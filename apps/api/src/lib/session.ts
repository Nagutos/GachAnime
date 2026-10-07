import { AppError } from '@gachanime/core'
import { getAuth } from './auth'

export interface SessionUser {
  id: string
  role: 'user' | 'admin'
}

export async function requireUser(request: Request): Promise<SessionUser> {
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session) throw new AppError('UNAUTHENTICATED', 'Sign in required')
  return { id: session.user.id, role: session.user.role === 'admin' ? 'admin' : 'user' }
}

/** Every admin route handler must call this: the role is always checked server-side. */
export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await requireUser(request)
  if (user.role !== 'admin') throw new AppError('FORBIDDEN', 'Admin role required')
  return user
}
