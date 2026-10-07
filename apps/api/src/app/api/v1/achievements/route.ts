import { listAchievements } from '@gachanime/core'
import { achievementsQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request, user }) => {
  const { status } = parseQuery(request, achievementsQuerySchema)
  return Response.json(await listAchievements(getDb(), user.id, status))
})
