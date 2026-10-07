import { playerProfiles, users, type Executor } from '@gachanime/db'
import type { AdminUser, Paginated } from '@gachanime/shared'
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { containsPattern } from '../catalog/admin-series'
import { AppError } from '../errors'

const selectUsers = (db: Executor) =>
  db
    .select({
      id: users.id,
      username: playerProfiles.username,
      displayName: users.name,
      avatarUrl: users.image,
      role: users.role,
      banned: users.banned,
      banReason: users.banReason,
      gemBalance: playerProfiles.gemBalance,
      owned: sql<number>`(SELECT count(*)::int FROM user_cards uc
        WHERE uc.user_id = "users"."id" AND uc.quantity > 0)`,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))

type UserRow = Awaited<ReturnType<ReturnType<typeof selectUsers>['execute']>>[number]
const toAdminUser = (row: UserRow): AdminUser => ({
  ...row,
  role: row.role === 'admin' ? 'admin' : 'user',
  createdAt: row.createdAt.toISOString(),
})

export async function listAdminUsers(
  db: Executor,
  query: {
    page: number
    pageSize: number
    search?: string
    role?: 'user' | 'admin'
    banned?: boolean
  },
): Promise<Paginated<AdminUser>> {
  const conditions: SQL[] = []
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(or(ilike(playerProfiles.username, pattern), ilike(users.name, pattern))!)
  }
  if (query.role) conditions.push(eq(users.role, query.role))
  if (query.banned !== undefined) conditions.push(eq(users.banned, query.banned))
  const where = conditions.length ? and(...conditions) : undefined
  const [rows, [total]] = await Promise.all([
    selectUsers(db)
      .where(where)
      .orderBy(desc(users.createdAt), asc(users.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(users)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(where),
  ])
  return {
    items: rows.map(toAdminUser),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function getAdminUser(db: Executor, id: string): Promise<AdminUser> {
  const [row] = await selectUsers(db).where(eq(users.id, id))
  if (!row) throw new AppError('NOT_FOUND', `User ${id} not found`)
  return toAdminUser(row)
}
