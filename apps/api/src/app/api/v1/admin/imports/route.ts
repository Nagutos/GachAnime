import { createImportJob, listImportJobs } from '@gachanime/core'
import { createImportSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { enqueueImportJob } from '@/lib/queue'

export const GET = adminRoute(async () => Response.json({ items: await listImportJobs(getDb()) }))

export const POST = adminRoute(async ({ request, actor }) => {
  const params = await parseJsonBody(request, createImportSchema)
  const job = await createImportJob(getDb(), { params, ...actor })
  await enqueueImportJob(job.id)
  return Response.json(job, { status: 201 })
}, 'adminAniList')
