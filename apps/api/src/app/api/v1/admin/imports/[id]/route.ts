import { getImportJob } from '@gachanime/core'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'

export const GET = adminRoute<{ id: string }>(async ({ params }) =>
  Response.json(await getImportJob(getDb(), parseId(params.id))),
)
