import { createDatabase } from '../client'
import { runMigrations } from '../migrate'
import { seed } from '../seed'
import { requireDatabaseUrl } from './env'

const { db, pool } = createDatabase(requireDatabaseUrl(), { max: 1 })
try {
  await runMigrations(db)
  await seed(db)
  console.log('Migrations applied and seed data ensured.')
} finally {
  await pool.end()
}
