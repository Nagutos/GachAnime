import { listAdminRarities } from '@gachanime/core'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'

export const GET = adminRoute(async () =>
  Response.json({ rarities: await listAdminRarities(getDb()) }),
)
