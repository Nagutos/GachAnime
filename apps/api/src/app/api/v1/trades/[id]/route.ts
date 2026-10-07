import { getTrade } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { parseId } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute<{ id: string }>(async ({ user, params }) =>
  Response.json(await getTrade(getDb(), user.id, parseId(params.id))),
)
