import { resumeImportJob } from '@gachanime/core'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { enqueueImportJob } from '@/lib/queue'

export const POST = adminRoute<{ id: string }>(async ({ actor, params }) => {
  const job = await resumeImportJob(getDb(), { id: parseId(params.id), ...actor })
  await enqueueImportJob(job.id)
  return Response.json(job)
}, 'adminAniList')
