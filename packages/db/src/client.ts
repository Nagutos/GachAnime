import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

export type Database = ReturnType<typeof createDatabase>['db']
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
/** Either the root database or a transaction: services accept both. */
export type Executor = Database | Transaction

export interface DatabaseOptions {
  max?: number
  /**
   * Called when an idle pooled connection fails (database restart, network cut). The pool drops
   * that connection and opens a new one on demand. Without a listener, Node treats the pool's
   * `error` event as uncaught and the whole process exits.
   */
  onError?: (error: Error) => void
}

export function createDatabase(connectionString: string, options: DatabaseOptions = {}) {
  const pool = new pg.Pool({ connectionString, max: options.max ?? 10 })
  pool.on('error', options.onError ?? ((error) => console.error('postgres pool error', error)))
  const db = drizzle({ client: pool, schema, casing: 'snake_case' })
  return { db, pool }
}
