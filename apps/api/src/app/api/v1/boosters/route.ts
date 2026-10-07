import { listBoosters } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ user }) =>
  Response.json(await listBoosters(getDb(), user.id)),
)
