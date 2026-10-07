import { parseArgs } from 'node:util'
import { createDatabase } from '@gachanime/db'
import { promoteAdminByDiscordId } from '../admin/roles'
import { AppError } from '../errors'

const { values } = parseArgs({ options: { 'discord-id': { type: 'string' } } })
const discordId = values['discord-id']
const databaseUrl = process.env.DATABASE_URL

if (!discordId || !databaseUrl) {
  console.error('Usage: pnpm admin:promote -- --discord-id <id>   (DATABASE_URL must be set)')
  process.exit(1)
}

const { db, pool } = createDatabase(databaseUrl, { max: 1 })
try {
  const changed = await promoteAdminByDiscordId(db, { discordId, actorId: null, reason: 'cli' })
  console.log(changed ? `Discord user ${discordId} is now an admin.` : 'Already an admin.')
} catch (error) {
  console.error(error instanceof AppError ? error.message : error)
  process.exitCode = 1
} finally {
  await pool.end()
}
