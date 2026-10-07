import { accounts, playerProfiles, users, type Executor } from '@gachanime/db'
import type { MeResponse, Role } from '@gachanime/shared'
import { and, eq } from 'drizzle-orm'
import { AppError } from '../errors'
import { emitEvents } from '../progression/engine'
import { toUsernameBase, usernameCandidate } from './username'

const MAX_USERNAME_ATTEMPTS = 50

/** Creates the game profile of a user if missing. Safe to call on every sign-in. */
export async function ensurePlayerProfile(
  db: Executor,
  input: { userId: string; displayName: string },
): Promise<void> {
  const existing = await db.query.playerProfiles.findFirst({
    columns: { userId: true },
    where: eq(playerProfiles.userId, input.userId),
  })
  if (existing) return

  const base = toUsernameBase(input.displayName)
  for (let attempt = 1; attempt <= MAX_USERNAME_ATTEMPTS; attempt++) {
    const inserted = await db
      .insert(playerProfiles)
      .values({ userId: input.userId, username: usernameCandidate(base, attempt) })
      .onConflictDoNothing()
      .returning({ userId: playerProfiles.userId })
    if (inserted.length > 0) {
      await emitEvents(db, input.userId, [{ type: 'account_created' }])
      return
    }

    // The conflict may come from a concurrent call creating the same profile.
    const created = await db.query.playerProfiles.findFirst({
      columns: { userId: true },
      where: eq(playerProfiles.userId, input.userId),
    })
    if (created) return
  }
  throw new AppError('CONFLICT', `Could not find a free username for "${base}"`)
}

export async function getMe(db: Executor, userId: string): Promise<MeResponse> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.name,
      avatarUrl: users.image,
      role: users.role,
      username: playerProfiles.username,
      locale: playerProfiles.locale,
      gemBalance: playerProfiles.gemBalance,
    })
    .from(users)
    .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))
    .where(eq(users.id, userId))
  const row = rows[0]
  if (!row) throw new AppError('NOT_FOUND', 'Player profile not found')
  return { ...row, role: row.role === 'admin' ? 'admin' : 'user' }
}

export async function updatePlayerLocale(
  db: Executor,
  userId: string,
  locale: string,
): Promise<void> {
  await db.update(playerProfiles).set({ locale }).where(eq(playerProfiles.userId, userId))
}

export async function findUserIdByDiscordId(
  db: Executor,
  discordId: string,
): Promise<string | null> {
  const account = await db.query.accounts.findFirst({
    columns: { userId: true },
    where: and(eq(accounts.providerId, 'discord'), eq(accounts.accountId, discordId)),
  })
  return account?.userId ?? null
}

export async function getUserRole(db: Executor, userId: string): Promise<Role> {
  const user = await db.query.users.findFirst({
    columns: { role: true },
    where: eq(users.id, userId),
  })
  return user?.role === 'admin' ? 'admin' : 'user'
}
