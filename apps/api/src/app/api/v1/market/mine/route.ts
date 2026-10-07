import { myListings } from '@gachanime/core'
import { myListingsQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request, user }) =>
  Response.json(await myListings(getDb(), user.id, parseQuery(request, myListingsQuerySchema))),
)
