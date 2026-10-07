import { listCollection } from '@gachanime/core'
import { collectionQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request, user }) =>
  Response.json(await listCollection(getDb(), user.id, parseQuery(request, collectionQuerySchema))),
)
