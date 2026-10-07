import { createDatabase } from '../client'
import { seed } from '../seed'
import { requireDatabaseUrl } from './env'

const { db, pool } = createDatabase(requireDatabaseUrl(), { max: 1 })
try {
  await seed(db)
  console.log('Seed data ensured.')
} finally {
  await pool.end()
}
