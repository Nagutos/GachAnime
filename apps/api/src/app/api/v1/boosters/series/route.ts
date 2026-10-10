import { listPoolSeries } from '@gachanime/core'
import { poolSeriesQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

/** `?theme=<pack key>`; no pack = the whole catalog. */
export const GET = playerRoute(async ({ request, user }) => {
  const { theme } = parseQuery(request, poolSeriesQuerySchema)
  return Response.json(await listPoolSeries(getDb(), user.id, theme ?? null))
})
