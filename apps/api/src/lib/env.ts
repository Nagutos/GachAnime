import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  /** Public URL of the instance, e.g. https://gachanime.example.com */
  PUBLIC_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, 'Use at least 32 random characters'),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  ADMIN_DISCORD_IDS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

/** Parsed lazily so that `next build` does not need runtime secrets. */
export function getEnv(): Env {
  if (!cached) {
    const result = envSchema.safeParse(process.env)
    if (!result.success) {
      const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      throw new Error(`Invalid environment variables:\n  ${issues.join('\n  ')}`)
    }
    cached = result.data
  }
  return cached
}
