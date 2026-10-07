import { listAdminBoosterTiers, updateBoosterTier } from '@gachanime/core'
import { updateBoosterTierSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const PATCH = adminRoute<{ key: string }>(async ({ request, actor, params }) => {
  const body = await parseJsonBody(request, updateBoosterTierSchema)
  await updateBoosterTier(getDb(), params.key, body, actor)
  return Response.json({ tiers: await listAdminBoosterTiers(getDb()) })
})
