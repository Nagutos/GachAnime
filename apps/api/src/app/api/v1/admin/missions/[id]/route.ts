import { listAdminMissions, updateMission } from '@gachanime/core'
import { updateMissionSchema } from '@gachanime/shared'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const PATCH = adminRoute<{ id: string }>(async ({ request, actor, params }) => {
  const body = await parseJsonBody(request, updateMissionSchema)
  await updateMission(getDb(), parseId(params.id), body, actor)
  return Response.json({ missions: await listAdminMissions(getDb()) })
})
