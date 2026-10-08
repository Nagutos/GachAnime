import { listTrades, proposeTrade } from '@gachanime/core'
import { proposeTradeSchema, tradesQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody, parseQuery } from '@/lib/http'
import { withIdempotency } from '@/lib/idempotency'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request, user }) =>
  Response.json(await listTrades(getDb(), user.id, parseQuery(request, tradesQuerySchema))),
)

export const POST = playerRoute(async ({ request, user }) => {
  const body = await parseJsonBody(request, proposeTradeSchema)
  const trade = await withIdempotency(request, user.id, () => proposeTrade(getDb(), user.id, body))
  return Response.json(trade, { status: 201 })
}, 'social')
