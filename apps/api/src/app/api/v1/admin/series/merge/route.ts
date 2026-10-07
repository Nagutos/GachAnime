import { mergeSeries } from '@gachanime/core'
import { mergeSeriesSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { enqueueProgressionRecompute } from '@/lib/queue'

export const POST = adminRoute(async ({ request, actor }) => {
  const body = await parseJsonBody(request, mergeSeriesSchema)
  await mergeSeries(getDb(), body, actor)
  await enqueueProgressionRecompute()
  return Response.json({ id: body.targetId })
})
