import { AppError } from '@gachanime/core'
import { getRedis } from './redis'

const TTL_SECONDS = 24 * 60 * 60
const IN_PROGRESS = '__in_progress__'

/**
 * Runs `operation` at most once per (user, Idempotency-Key). A retry with the same key gets the
 * stored result instead of executing the game action twice. Without a key, runs normally.
 */
export async function withIdempotency<T>(
  request: Request,
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = request.headers.get('idempotency-key')
  if (!key) return operation()
  if (!/^[\w-]{8,128}$/.test(key)) throw new AppError('BAD_REQUEST', 'Invalid Idempotency-Key')

  const redis = getRedis()
  const redisKey = `idem:${userId}:${key}`
  const acquired = await redis.set(redisKey, IN_PROGRESS, 'EX', TTL_SECONDS, 'NX')
  if (!acquired) {
    const stored = await redis.get(redisKey)
    if (stored === null || stored === IN_PROGRESS) {
      throw new AppError('IDEMPOTENCY_IN_PROGRESS', 'This request is already being processed')
    }
    return JSON.parse(stored) as T
  }

  try {
    const result = await operation()
    await redis.set(redisKey, JSON.stringify(result), 'EX', TTL_SECONDS)
    return result
  } catch (error) {
    await redis.del(redisKey)
    throw error
  }
}
