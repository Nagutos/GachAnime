import { existsSync } from 'node:fs'

// Local runs read the root .env (like the apps do); CI sets the variables explicitly.
const rootEnv = new URL('../../.env', import.meta.url)
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

export const WEB_PORT = 4173
export const API_PORT = 3100
export const baseUrl = process.env.E2E_BASE_URL ?? `http://localhost:${WEB_PORT}`

/**
 * Player flows need the API with Postgres and Redis. They run when the test database, Redis and
 * an auth secret are configured; otherwise only the signed-out smoke tests run.
 */
export const fullStack = Boolean(
  process.env.TEST_DATABASE_URL && process.env.REDIS_URL && process.env.BETTER_AUTH_SECRET,
)

/** Dedicated database of the e2e suite: `<TEST_DATABASE_URL database>_e2e`. */
export function e2eDatabaseUrl(): string {
  const url = new URL(process.env.TEST_DATABASE_URL as string)
  url.pathname = `${url.pathname}_e2e`
  return url.toString()
}
