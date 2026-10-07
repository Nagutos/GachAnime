import { createDatabase, type Database } from '@gachanime/db'
import { getEnv } from './env'
import { singleton } from './singleton'

export function getDb(): Database {
  return singleton('db', () => createDatabase(getEnv().DATABASE_URL).db)
}
