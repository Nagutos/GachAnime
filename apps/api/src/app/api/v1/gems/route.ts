import { listGemHistory } from '@gachanime/core'
import { paginationQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request, user }) =>
  Response.json(await listGemHistory(getDb(), user.id, parseQuery(request, paginationQuerySchema))),
)
