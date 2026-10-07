import { createManualSeries, listSeries } from '@gachanime/core'
import { adminSeriesQuerySchema, createManualSeriesSchema } from '@gachanime/shared'
import { adminRoute, parseQuery } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const GET = adminRoute(async ({ request }) =>
  Response.json(await listSeries(getDb(), parseQuery(request, adminSeriesQuerySchema))),
)

export const POST = adminRoute(async ({ request, actor }) => {
  const body = await parseJsonBody(request, createManualSeriesSchema)
  return Response.json(await createManualSeries(getDb(), body, actor), { status: 201 })
})
