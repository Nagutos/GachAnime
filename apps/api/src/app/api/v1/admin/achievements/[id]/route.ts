import { listAdminAchievements, updateAchievement } from '@gachanime/core'
import { updateAchievementSchema } from '@gachanime/shared'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const PATCH = adminRoute<{ id: string }>(async ({ request, actor, params }) => {
  const body = await parseJsonBody(request, updateAchievementSchema)
  await updateAchievement(getDb(), parseId(params.id), body, actor)
  return Response.json({ achievements: await listAdminAchievements(getDb()) })
})
