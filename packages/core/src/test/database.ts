import type { Database } from '@gachanime/db'
import { sql } from 'drizzle-orm'

export { resetTestDatabase, setupTestDatabase, testDatabaseUrl } from '@gachanime/db/testing'

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
