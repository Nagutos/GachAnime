import { cancelTrade } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { parseId } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const POST = playerRoute<{ id: string }>(
  async ({ user, params }) =>
    Response.json(await cancelTrade(getDb(), user.id, parseId(params.id))),
  'economy',
)
