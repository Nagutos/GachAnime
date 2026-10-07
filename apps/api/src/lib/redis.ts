import { Redis } from 'ioredis'
import { getEnv } from './env'
import { logger } from './logger'
import { singleton } from './singleton'

export function getRedis(): Redis {
  return singleton('redis', () => {
    const redis = new Redis(getEnv().REDIS_URL, { maxRetriesPerRequest: 2 })
    redis.on('error', (error) => logger.error({ err: error }, 'redis error'))
    return redis
  })
}
