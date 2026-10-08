import { ensurePlayerProfile, parseAdminDiscordIds, promoteAdminByDiscordId } from '@gachanime/core'
import { accounts, schema, users } from '@gachanime/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { and, eq } from 'drizzle-orm'
import { getDb } from './db'
import { getEnv } from './env'
import { logger } from './logger'
import { getRedis } from './redis'
import { singleton } from './singleton'

/** INCR, setting the TTL only when the counter is created (fixed window). */
const INCREMENT_WITH_TTL = `
local value = redis.call('INCR', KEYS[1])
if value == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return value
`

function createAuth() {
  const env = getEnv()
  const db = getDb()
  const redis = getRedis()
  const adminDiscordIds = parseAdminDiscordIds(env.ADMIN_DISCORD_IDS)

  /** Profile creation and `ADMIN_DISCORD_IDS` bootstrap, run on every sign-in. */
  async function onSignIn(userId: string): Promise<void> {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user) return
    await ensurePlayerProfile(db, { userId, displayName: user.name })

    if (user.role === 'admin' || adminDiscordIds.size === 0) return
    const discord = await db.query.accounts.findFirst({
      columns: { accountId: true },
      where: and(eq(accounts.userId, userId), eq(accounts.providerId, 'discord')),
    })
    if (discord && adminDiscordIds.has(discord.accountId)) {
      await promoteAdminByDiscordId(db, {
        discordId: discord.accountId,
        actorId: null,
        reason: 'ADMIN_DISCORD_IDS',
      })
      logger.info({ userId }, 'user promoted to admin from ADMIN_DISCORD_IDS')
    }
  }

  return betterAuth({
    appName: 'GachAnime',
    baseURL: env.PUBLIC_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    // Browsers send the bare origin: a PUBLIC_URL with a path or a trailing slash must still match.
    trustedOrigins: [new URL(env.PUBLIC_URL).origin],
    database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
    secondaryStorage: {
      get: (key) => redis.get(`auth:${key}`),
      getAndDelete: (key) => redis.getdel(`auth:${key}`),
      set: async (key, value, ttl) => {
        if (ttl) await redis.set(`auth:${key}`, value, 'EX', ttl)
        else await redis.set(`auth:${key}`, value)
      },
      delete: async (key) => {
        await redis.del(`auth:${key}`)
      },
      increment: async (key, ttl) =>
        Number(await redis.eval(INCREMENT_WITH_TTL, 1, `auth:${key}`, ttl)),
    },
    rateLimit: { enabled: true, storage: 'secondary-storage' },
    emailAndPassword: { enabled: false },
    socialProviders: {
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
      },
    },
    plugins: [admin()],
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await onSignIn(session.userId)
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

export function getAuth(): Auth {
  return singleton('auth', createAuth)
}

/**
 * Role and ban changes, through Better Auth's internal adapter (it keeps its session storage
 * consistent and revokes a banned user's sessions). The admin plugin's endpoints are not used:
 * they authorize the caller from the role cached in its session, which is stale for an admin
 * promoted after signing in. Callers must have checked the admin role (`requireAdmin`).
 */
export async function setUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
  const { internalAdapter } = await getAuth().$context
  await internalAdapter.updateUser(userId, { role, updatedAt: new Date() })
}

export async function setUserBan(
  userId: string,
  ban: { banned: true; reason: string | null } | { banned: false },
): Promise<void> {
  const { internalAdapter } = await getAuth().$context
  await internalAdapter.updateUser(userId, {
    banned: ban.banned,
    banReason: ban.banned ? ban.reason : null,
    banExpires: null,
    updatedAt: new Date(),
  })
  if (ban.banned) await internalAdapter.deleteUserSessions(userId)
}
