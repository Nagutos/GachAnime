import { splitSeries } from '@gachanime/core'
import { splitSeriesSchema } from '@gachanime/shared'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const POST = adminRoute<{ id: string }>(async ({ request, actor, params }) => {
  const body = await parseJsonBody(request, splitSeriesSchema)
  return Response.json(await splitSeries(getDb(), parseId(params.id), body, actor), { status: 201 })
})
