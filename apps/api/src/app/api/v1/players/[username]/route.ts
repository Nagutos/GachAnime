import { getPlayerProfile } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute<{ username: string }>(async ({ user, params }) =>
  Response.json(await getPlayerProfile(getDb(), user.id, params.username)),
)
