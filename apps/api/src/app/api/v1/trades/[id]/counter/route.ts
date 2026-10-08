import { counterTrade } from '@gachanime/core'
import { counterTradeSchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseId, parseJsonBody } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const POST = playerRoute<{ id: string }>(async ({ request, user, params }) => {
  const body = await parseJsonBody(request, counterTradeSchema)
  return Response.json(await counterTrade(getDb(), user.id, parseId(params.id), body), {
    status: 201,
  })
}, 'social')
