import { importRoster } from '@gachanime/core'
import { rosterImportSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const POST = adminRoute(async ({ request, actor }) => {
  const roster = await parseJsonBody(request, rosterImportSchema)
  return Response.json(await importRoster(getDb(), roster, actor))
})
