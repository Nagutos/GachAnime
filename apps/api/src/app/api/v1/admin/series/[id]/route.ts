import { deleteSeries, getSeriesDetail, updateSeries } from '@gachanime/core'
import { updateSeriesSchema } from '@gachanime/shared'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { enqueueProgressionRecompute } from '@/lib/queue'

type Params = { id: string }

export const GET = adminRoute<Params>(async ({ params }) =>
  Response.json(await getSeriesDetail(getDb(), parseId(params.id))),
)

export const PATCH = adminRoute<Params>(async ({ request, actor, params }) => {
  const id = parseId(params.id)
  await updateSeries(getDb(), id, await parseJsonBody(request, updateSeriesSchema), actor)
  await enqueueProgressionRecompute()
  return Response.json(await getSeriesDetail(getDb(), id))
})

export const DELETE = adminRoute<Params>(async ({ actor, params }) => {
  await deleteSeries(getDb(), parseId(params.id), actor)
  await enqueueProgressionRecompute()
  return new Response(null, { status: 204 })
})
