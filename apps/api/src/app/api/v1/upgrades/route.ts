import { listUpgrades } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ user }) =>
  Response.json(await listUpgrades(getDb(), user.id)),
)
