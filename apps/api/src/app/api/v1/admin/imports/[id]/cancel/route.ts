import { cancelImportJob } from '@gachanime/core'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'

export const POST = adminRoute<{ id: string }>(async ({ actor, params }) =>
  Response.json(await cancelImportJob(getDb(), { id: parseId(params.id), ...actor })),
)
