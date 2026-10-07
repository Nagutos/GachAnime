import { listFeedback } from '@gachanime/core'
import { adminFeedbackQuerySchema } from '@gachanime/shared'
import { adminRoute, parseQuery } from '@/lib/admin'
import { getDb } from '@/lib/db'

export const GET = adminRoute(async ({ request }) =>
  Response.json(await listFeedback(getDb(), parseQuery(request, adminFeedbackQuerySchema))),
)
