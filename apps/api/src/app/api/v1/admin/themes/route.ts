import { createTheme, listAdminThemes } from '@gachanime/core'
import { createThemeSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const GET = adminRoute(async () => Response.json({ themes: await listAdminThemes(getDb()) }))

export const POST = adminRoute(async ({ request, actor }) => {
  const body = await parseJsonBody(request, createThemeSchema)
  return Response.json(await createTheme(getDb(), body, actor), { status: 201 })
})
