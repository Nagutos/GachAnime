import { AppError } from '@gachanime/core'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { getRedis } from './redis'
import { singleton } from './singleton'

/** Named policies: `points` requests per `duration` seconds, per key (user id or IP). */
export const RATE_LIMIT_POLICIES = {
  default: { points: 120, duration: 60 },
  profileUpdate: { points: 20, duration: 60 },
  /** Booster openings (each request is one transaction of up to 50 cards). */
  boosterOpen: { points: 30, duration: 60 },
  admin: { points: 300, duration: 60 },
  /** Calls that reach AniList (search) or start long jobs. */
  adminAniList: { points: 20, duration: 60 },
} as const

export type RateLimitPolicy = keyof typeof RATE_LIMIT_POLICIES

function getLimiter(policy: RateLimitPolicy): RateLimiterRedis {
  return singleton(
    `rate-limit:${policy}`,
    () =>
      new RateLimiterRedis({
        storeClient: getRedis(),
        keyPrefix: `rl:${policy}`,
        ...RATE_LIMIT_POLICIES[policy],
      }),
  )
}

export async function enforceRateLimit(policy: RateLimitPolicy, key: string): Promise<void> {
  try {
    await getLimiter(policy).consume(key)
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      throw new AppError('RATE_LIMITED', 'Too many requests', {
        retryAfterSeconds: Math.ceil(error.msBeforeNext / 1000),
      })
    }
    throw error
  }
}
