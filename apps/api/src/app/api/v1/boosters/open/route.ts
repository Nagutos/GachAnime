import { openBoosters } from '@gachanime/core'
import { openBoostersRequestSchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { withIdempotency } from '@/lib/idempotency'
import { playerRoute } from '@/lib/player'

/** Opens x1/x5/x10 boosters. Clients send an Idempotency-Key so a retry never opens twice. */
export const POST = playerRoute(async ({ request, user }) => {
  const body = await parseJsonBody(request, openBoostersRequestSchema)
  const result = await withIdempotency(request, user.id, () => openBoosters(getDb(), user.id, body))
  return Response.json(result)
}, 'boosterOpen')
