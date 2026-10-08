import { reorderThemes } from '@gachanime/core'
import { reorderThemesSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

/** Shop order of the packs. */
export const PUT = adminRoute(async ({ request, actor }) => {
  const { ids } = await parseJsonBody(request, reorderThemesSchema)
  await reorderThemes(getDb(), ids, actor)
  return new Response(null, { status: 204 })
})
