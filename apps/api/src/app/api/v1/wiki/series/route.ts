import { listWikiSeries } from '@gachanime/core'
import { wikiSeriesQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request, user }) =>
  Response.json(await listWikiSeries(getDb(), user.id, parseQuery(request, wikiSeriesQuerySchema))),
)
