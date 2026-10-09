import { reorderFavorites } from '@gachanime/core'
import { reorderFavoritesSchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { playerRoute } from '@/lib/player'

/** Order of the player's favorites (every favorite exactly once). */
export const PUT = playerRoute(async ({ request, user }) => {
  const { ids } = await parseJsonBody(request, reorderFavoritesSchema)
  await reorderFavorites(getDb(), user.id, ids)
  return new Response(null, { status: 204 })
}, 'economy')
