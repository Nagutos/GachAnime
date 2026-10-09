import { findPlayer, getPlayerWishlist } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute<{ username: string }>(async ({ user, params }) => {
  const owner = await findPlayer(getDb(), params.username)
  return Response.json(await getPlayerWishlist(getDb(), owner.userId, user.id))
})
