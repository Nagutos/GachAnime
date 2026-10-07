import { createManualCharacter, listCharacters } from '@gachanime/core'
import { adminCharactersQuerySchema, createManualCharacterSchema } from '@gachanime/shared'
import { adminRoute, parseQuery } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const GET = adminRoute(async ({ request }) =>
  Response.json(await listCharacters(getDb(), parseQuery(request, adminCharactersQuerySchema))),
)

export const POST = adminRoute(async ({ request, actor }) => {
  const body = await parseJsonBody(request, createManualCharacterSchema)
  return Response.json(await createManualCharacter(getDb(), body, actor), { status: 201 })
})
