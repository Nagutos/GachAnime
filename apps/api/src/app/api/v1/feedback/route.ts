import { getMyFeedback, submitFeedback } from '@gachanime/core'
import { feedbackRequestSchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ user }) =>
  Response.json(await getMyFeedback(getDb(), user.id)),
)

export const PUT = playerRoute(async ({ request, user }) => {
  const body = await parseJsonBody(request, feedbackRequestSchema)
  return Response.json(await submitFeedback(getDb(), user.id, body))
}, 'profileUpdate')
