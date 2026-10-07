import { recycleCards } from '@gachanime/core'
import { recycleCardsRequestSchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { withIdempotency } from '@/lib/idempotency'
import { playerRoute } from '@/lib/player'

export const POST = playerRoute(async ({ request, user }) => {
  const body = await parseJsonBody(request, recycleCardsRequestSchema)
  return Response.json(
    await withIdempotency(request, user.id, () => recycleCards(getDb(), user.id, body)),
  )
}, 'economy')
