import { parseArgs } from 'node:util'
import { createDatabase } from '@gachanime/db'
import { AppError } from '../errors'
import { adjustGems } from '../players/gems'
import { findUserIdByDiscordId } from '../players/profile'
import { cliArgs } from './args'

const { values } = parseArgs({
  args: cliArgs(),
  options: {
    'discord-id': { type: 'string' },
    amount: { type: 'string' },
    note: { type: 'string', default: 'cli' },
  },
})
const amount = Number(values.amount)
const databaseUrl = process.env.DATABASE_URL

if (!values['discord-id'] || !Number.isInteger(amount) || amount === 0 || !databaseUrl) {
  console.error(
    'Usage: pnpm admin:grant-gems -- --discord-id <id> --amount <gems, negative to remove> [--note <text>]',
  )
  process.exit(1)
}

const { db, pool } = createDatabase(databaseUrl, { max: 1 })
try {
  const userId = await findUserIdByDiscordId(db, values['discord-id'])
  if (!userId) throw new AppError('NOT_FOUND', 'No user signed in with this Discord id')
  const balance = await adjustGems(db, { userId, amount, note: values.note }, { actorId: null })
  console.log(`Done: new balance ${balance} gems.`)
} catch (error) {
  console.error(error instanceof AppError ? error.message : error)
  process.exitCode = 1
} finally {
  await pool.end()
}
