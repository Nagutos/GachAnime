import { setFavorite } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { parseId } from '@/lib/http'
import { playerRoute } from '@/lib/player'

type Params = { characterId: string }

export const PUT = playerRoute<Params>(
  async ({ user, params }) =>
    Response.json(await setFavorite(getDb(), user.id, parseId(params.characterId), true)),
  'economy',
)

export const DELETE = playerRoute<Params>(
  async ({ user, params }) =>
    Response.json(await setFavorite(getDb(), user.id, parseId(params.characterId), false)),
  'economy',
)
