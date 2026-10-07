import { users, type Database } from '@gachanime/db'
import { eq } from 'drizzle-orm'
import { AppError } from '../errors'
import { findUserIdByDiscordId } from '../players/profile'
import { recordAdminAction } from './audit'

/**
 * Grants the admin role to the user signed in with this Discord id.
 * Returns false when the user already was an admin.
 */
export async function promoteAdminByDiscordId(
  db: Database,
  input: { discordId: string; actorId: string | null; reason: string },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const userId = await findUserIdByDiscordId(tx, input.discordId)
    if (!userId) {
      throw new AppError(
        'NOT_FOUND',
        `No user signed in with Discord id ${input.discordId} yet. Sign in once, then retry.`,
      )
    }
    const [user] = await tx
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
    if (user?.role === 'admin') return false

    await tx.update(users).set({ role: 'admin' }).where(eq(users.id, userId))
    await recordAdminAction(tx, {
      actorId: input.actorId,
      action: 'user.promote_admin',
      targetType: 'user',
      targetId: userId,
      before: { role: user?.role ?? null },
      after: { role: 'admin', reason: input.reason },
    })
    return true
  })
}

/** Parses `ADMIN_DISCORD_IDS` (comma or space separated Discord snowflakes). */
export function parseAdminDiscordIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter((id) => /^\d{5,25}$/.test(id)),
  )
}
