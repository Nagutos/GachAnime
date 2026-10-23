import { createDatabase, type Database } from '@gachanime/db'
import { getEnv } from './env'
import { logger } from './logger'
import { singleton } from './singleton'

export function getDb(): Database {
  return singleton(
    'db',
    () =>
      createDatabase(getEnv().DATABASE_URL, {
        onError: (error) => logger.error({ err: error }, 'postgres pool error'),
      }).db,
  )
}
