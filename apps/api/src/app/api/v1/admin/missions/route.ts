import { createMission, listAdminMissions } from '@gachanime/core'
import { createMissionSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const GET = adminRoute(async () =>
  Response.json({ missions: await listAdminMissions(getDb()) }),
)

export const POST = adminRoute(async ({ request, actor }) => {
  const body = await parseJsonBody(request, createMissionSchema)
  return Response.json(await createMission(getDb(), body, actor), { status: 201 })
})
