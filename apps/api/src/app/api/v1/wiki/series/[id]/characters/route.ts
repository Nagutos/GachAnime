import { listWikiSeriesCharacters } from '@gachanime/core'
import { wikiCharactersQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseId, parseQuery } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute<{ id: string }>(async ({ request, user, params }) =>
  Response.json(
    await listWikiSeriesCharacters(
      getDb(),
      user.id,
      parseId(params.id),
      parseQuery(request, wikiCharactersQuerySchema),
    ),
  ),
)
