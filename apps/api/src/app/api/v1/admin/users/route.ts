import { listAdminUsers } from '@gachanime/core'
import { adminUsersQuerySchema } from '@gachanime/shared'
import { adminRoute, parseQuery } from '@/lib/admin'
import { getDb } from '@/lib/db'

export const GET = adminRoute(async ({ request }) =>
  Response.json(await listAdminUsers(getDb(), parseQuery(request, adminUsersQuerySchema))),
)
