import { AppError, createImportJob, listImportJobs } from '@gachanime/core'
import { createImportSchema, importSource } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { isIgdbConfigured } from '@/lib/igdb'
import { enqueueImportJob } from '@/lib/queue'

export const GET = adminRoute(async () =>
  Response.json({ items: await listImportJobs(getDb()), igdbConfigured: isIgdbConfigured() }),
)

export const POST = adminRoute(async ({ request, actor }) => {
  const params = await parseJsonBody(request, createImportSchema)
  if (importSource(params) === 'igdb' && !isIgdbConfigured()) {
    throw new AppError('IGDB_NOT_CONFIGURED', 'IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are not set')
  }
  const job = await createImportJob(getDb(), { params, ...actor })
  await enqueueImportJob(job.id)
  return Response.json(job, { status: 201 })
}, 'adminAniList')
