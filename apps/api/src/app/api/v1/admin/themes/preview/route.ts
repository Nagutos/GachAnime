import { previewTheme } from '@gachanime/core'
import { themePreviewRequestSchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const POST = adminRoute(async ({ request }) => {
  const { rules } = await parseJsonBody(request, themePreviewRequestSchema)
  return Response.json(await previewTheme(getDb(), rules))
})
