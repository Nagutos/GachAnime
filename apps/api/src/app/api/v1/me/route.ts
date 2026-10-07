import { getMe, updatePlayerLocale } from '@gachanime/core'
import { updateMeRequestSchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody, route } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { requireUser } from '@/lib/session'

export const GET = route(async (request) => {
  const user = await requireUser(request)
  return Response.json(await getMe(getDb(), user.id))
})

export const PATCH = route(async (request) => {
  const user = await requireUser(request)
  await enforceRateLimit('profileUpdate', user.id)
  const body = await parseJsonBody(request, updateMeRequestSchema)
  await updatePlayerLocale(getDb(), user.id, body.locale)
  return Response.json(await getMe(getDb(), user.id))
})
