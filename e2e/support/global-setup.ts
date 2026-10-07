import { resetTestDatabase, setupTestDatabase } from '@gachanime/db/testing'
import { seedE2eCatalog } from './catalog'
import { fullStack } from './env'

/** Fresh e2e database with a small catalog before every run. */
export default async function globalSetup(): Promise<void> {
  if (!fullStack) return
  const { db, close } = await setupTestDatabase(process.env.TEST_DATABASE_URL as string, 'e2e')
  try {
    await resetTestDatabase(db)
    await seedE2eCatalog(db)
  } finally {
    await close()
  }
}
