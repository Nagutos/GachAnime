import { randomUUID } from 'node:crypto'
import { ensurePlayerProfile } from '@gachanime/core'
import { accounts, createDatabase, schema, users } from '@gachanime/db'
import type { BrowserContext } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, testUtils } from 'better-auth/plugins'
import { Redis } from 'ioredis'

type TestHelpers = ReturnType<ReturnType<typeof testUtils>['init']>['context']['test']
import { baseUrl, e2eDatabaseUrl } from './env'

/**
 * Signs a new player in without Discord: creates the user and its Discord account row like an
 * OAuth sign-in would, runs the same profile creation as the API sign-in hook, then opens a real
 * Better Auth session (test-only auth instance sharing the API's secret and Redis storage).
 */
export async function signInNewPlayer(
  context: BrowserContext,
  name = 'E2E Player',
  databaseUrl = e2eDatabaseUrl(),
): Promise<{ userId: string }> {
  const { db, pool } = createDatabase(databaseUrl, { max: 2 })
  const redis = new Redis(process.env.REDIS_URL as string)
  try {
    const userId = `e2e-${randomUUID()}`
    await db.insert(users).values({ id: userId, name, email: `${userId}@example.test` })
    await db.insert(accounts).values({
      id: `acc-${userId}`,
      userId,
      providerId: 'discord',
      accountId: String(Date.now()) + String(Math.floor(Math.random() * 1000)),
    })
    await ensurePlayerProfile(db, { userId, displayName: name })

    const auth = betterAuth({
      baseURL: baseUrl,
      basePath: '/api/auth',
      secret: process.env.BETTER_AUTH_SECRET,
      database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
      // Same layout as apps/api/src/lib/auth.ts, so the API finds the session.
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
        increment: (key) => redis.incr(`auth:${key}`),
      },
      plugins: [admin(), testUtils()],
    })
    // `$context` does not infer plugin contexts here: type the test helpers explicitly.
    const { test } = (await auth.$context) as unknown as { test: TestHelpers }
    const { cookies } = await test.login({ userId })
    await context.addCookies(cookies)
    return { userId }
  } finally {
    redis.disconnect()
    await pool.end()
  }
}
