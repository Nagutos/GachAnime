import { createAchievement, listAdminAchievements } from '@gachanime/core'
import { createAchievementSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const GET = adminRoute(async () =>
  Response.json({ achievements: await listAdminAchievements(getDb()) }),
)

export const POST = adminRoute(async ({ request, actor }) => {
  const body = await parseJsonBody(request, createAchievementSchema)
  return Response.json(await createAchievement(getDb(), body, actor), { status: 201 })
})
