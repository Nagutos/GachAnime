import { claimMission } from '@gachanime/core'
import { claimMissionRequestSchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const POST = playerRoute(async ({ request, user }) => {
  const body = await parseJsonBody(request, claimMissionRequestSchema)
  return Response.json(await claimMission(getDb(), user.id, body))
}, 'economy')
