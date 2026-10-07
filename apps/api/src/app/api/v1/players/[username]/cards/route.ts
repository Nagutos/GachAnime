import { findPlayer, listPlayerCards } from '@gachanime/core'
import { playerCardsQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute<{ username: string }>(async ({ request, user, params }) => {
  const owner = await findPlayer(getDb(), params.username)
  return Response.json(
    await listPlayerCards(
      getDb(),
      owner.userId,
      user.id,
      parseQuery(request, playerCardsQuerySchema),
    ),
  )
})
