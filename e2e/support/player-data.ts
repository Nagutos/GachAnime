import { adjustGems } from '@gachanime/core'
import { characters, createDatabase, userCards } from '@gachanime/db'
import { asc } from 'drizzle-orm'
import { e2eDatabaseUrl } from './env'

/** Gives gems to a player (audited admin adjustment, like `pnpm admin:grant-gems`). */
export async function grantGems(userId: string, amount: number): Promise<void> {
  const { db, pool } = createDatabase(e2eDatabaseUrl(), { max: 1 })
  try {
    await adjustGems(db, { userId, amount, note: 'e2e' }, { actorId: null })
  } finally {
    await pool.end()
  }
}

/** Gives `quantity` copies of `count` catalog characters, starting at the `offset`-th one. */
export async function giveCards(
  userId: string,
  count: number,
  quantity: number,
  offset = 0,
): Promise<number[]> {
  const { db, pool } = createDatabase(e2eDatabaseUrl(), { max: 1 })
  try {
    const rows = await db
      .select({ id: characters.id })
      .from(characters)
      .orderBy(asc(characters.id))
      .limit(count)
      .offset(offset)
    await db
      .insert(userCards)
      .values(rows.map((row) => ({ userId, characterId: row.id, quantity })))
    return rows.map((row) => row.id)
  } finally {
    await pool.end()
  }
}
