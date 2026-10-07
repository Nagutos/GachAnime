import { createDatabase, type Database } from '@gachanime/db'
import { runMigrations } from '@gachanime/db/migrate'
import { sql } from 'drizzle-orm'

/** Integration tests run only when TEST_DATABASE_URL points to a disposable database. */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL

export async function setupTestDatabase(url: string) {
  const { db, pool } = createDatabase(url, { max: 4 })
  await runMigrations(db)
  return { db, close: () => pool.end() }
}

export async function resetTestDatabase(db: Database): Promise<void> {
  await db.execute(
    sql`TRUNCATE users, sessions, accounts, verifications, player_profiles, settings, admin_audit_log RESTART IDENTITY CASCADE`,
  )
}

export async function insertDiscordUser(
  db: Database,
  input: { id: string; name: string; discordId: string },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO users (id, name, email) VALUES (${input.id}, ${input.name}, ${`${input.id}@example.test`});
  `)
  await db.execute(sql`
    INSERT INTO accounts (id, account_id, provider_id, user_id)
    VALUES (${`acc_${input.id}`}, ${input.discordId}, 'discord', ${input.id});
  `)
}
