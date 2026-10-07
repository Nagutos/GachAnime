import { getWikiCharacter, recordWikiView } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { parseId } from '@/lib/http'
import { playerRoute } from '@/lib/player'

/** Reading an unlocked entry counts for the daily wiki mission. */
export const GET = playerRoute<{ id: string }>(async ({ user, params }) => {
  const entry = await getWikiCharacter(getDb(), user.id, parseId(params.id))
  if (!entry.locked) await recordWikiView(getDb(), user.id, entry.id)
  return Response.json(entry)
})
