import { listAdminActions } from '@gachanime/core'
import { auditLogQuerySchema } from '@gachanime/shared'
import { adminRoute, parseQuery } from '@/lib/admin'
import { getDb } from '@/lib/db'

export const GET = adminRoute(async ({ request }) =>
  Response.json(await listAdminActions(getDb(), parseQuery(request, auditLogQuerySchema))),
)
