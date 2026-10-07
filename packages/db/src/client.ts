import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

export type Database = ReturnType<typeof createDatabase>['db']
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
/** Either the root database or a transaction: services accept both. */
export type Executor = Database | Transaction

export function createDatabase(connectionString: string, options: { max?: number } = {}) {
  const pool = new pg.Pool({ connectionString, max: options.max ?? 10 })
  const db = drizzle({ client: pool, schema, casing: 'snake_case' })
  return { db, pool }
}
