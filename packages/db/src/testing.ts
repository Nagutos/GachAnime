// Test helpers for integration tests against a real Postgres (TEST_DATABASE_URL).
import { sql } from 'drizzle-orm'
import pg from 'pg'
import { createDatabase, type Database } from './client'
import { runMigrations } from './migrate'
import { seed } from './seed'

/** Integration tests run only when TEST_DATABASE_URL points to a disposable server. */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL

/**
 * Creates (if needed) and migrates a database dedicated to one package, named
 * `<TEST_DATABASE_URL database>_<suffix>`: turbo runs package test suites in parallel.
 */
export async function setupTestDatabase(baseUrl: string, suffix: string) {
  const url = new URL(baseUrl)
  const name = `${url.pathname.slice(1)}_${suffix}`
  if (!/^\w+$/.test(name)) throw new Error(`Invalid test database name: ${name}`)

  const admin = new pg.Client({ connectionString: baseUrl })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${name}"`)
  } finally {
    await admin.end()
  }

  url.pathname = `/${name}`
  const { db, pool } = createDatabase(url.toString(), { max: 6 })
  await runMigrations(db)
  return { db, close: () => pool.end() }
}

/** Empties every table, then re-inserts the seed rows. */
export async function resetTestDatabase(db: Database): Promise<void> {
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  )
  const tables = result.rows.map((row) => `"${row.tablename}"`).join(', ')
  if (tables) await db.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`))
  await seed(db)
}
