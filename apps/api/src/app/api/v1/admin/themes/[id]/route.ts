import { deleteTheme, listAdminThemes, updateTheme } from '@gachanime/core'
import { updateThemeSchema } from '@gachanime/shared'
import { adminRoute, parseId } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

type Params = { id: string }

export const PATCH = adminRoute<Params>(async ({ request, actor, params }) => {
  const body = await parseJsonBody(request, updateThemeSchema)
  await updateTheme(getDb(), parseId(params.id), body, actor)
  return Response.json({ themes: await listAdminThemes(getDb()) })
})

export const DELETE = adminRoute<Params>(async ({ actor, params }) => {
  await deleteTheme(getDb(), parseId(params.id), actor)
  return new Response(null, { status: 204 })
})
