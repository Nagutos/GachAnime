import { getCharacter, updateCharacter } from '@gachanime/core'
import { updateCharacterSchema } from '@gachanime/shared'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

type Params = { id: string }

export const GET = adminRoute<Params>(async ({ params }) =>
  Response.json(await getCharacter(getDb(), parseId(params.id))),
)

export const PATCH = adminRoute<Params>(async ({ request, actor, params }) => {
  const id = parseId(params.id)
  await updateCharacter(getDb(), id, await parseJsonBody(request, updateCharacterSchema), actor)
  return Response.json(await getCharacter(getDb(), id))
})
