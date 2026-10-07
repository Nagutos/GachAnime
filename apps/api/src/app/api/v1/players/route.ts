import { listPlayers } from '@gachanime/core'
import { playersQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request }) =>
  Response.json(await listPlayers(getDb(), parseQuery(request, playersQuerySchema))),
)
