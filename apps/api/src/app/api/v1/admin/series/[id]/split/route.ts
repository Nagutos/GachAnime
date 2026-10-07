import { splitSeries } from '@gachanime/core'
import { splitSeriesSchema } from '@gachanime/shared'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { enqueueProgressionRecompute } from '@/lib/queue'

export const POST = adminRoute<{ id: string }>(async ({ request, actor, params }) => {
  const body = await parseJsonBody(request, splitSeriesSchema)
  const result = await splitSeries(getDb(), parseId(params.id), body, actor)
  await enqueueProgressionRecompute()
  return Response.json(result, { status: 201 })
})
