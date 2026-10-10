import { listPublicTrades } from '@gachanime/core'
import { publicTradesQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request, user }) =>
  Response.json(
    await listPublicTrades(getDb(), user.id, parseQuery(request, publicTradesQuerySchema)),
  ),
)
