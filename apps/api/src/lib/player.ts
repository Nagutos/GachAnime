import { route } from './http'
import { enforceRateLimit, type RateLimitPolicy } from './rate-limit'
import { requireUser, type SessionUser } from './session'

type PlayerHandler<P> = (input: {
  request: Request
  user: SessionUser
  params: P
}) => Promise<Response>

/** Signed-in player route: session check, rate limit per user, resolved route params. */
export function playerRoute<P = Record<string, never>>(
  handler: PlayerHandler<P>,
  policy: RateLimitPolicy = 'default',
) {
  return route<{ params: Promise<P> }>(async (request, context) => {
    const user = await requireUser(request)
    await enforceRateLimit(policy, user.id)
    const params = (await context?.params) ?? ({} as P)
    return handler({ request, user, params })
  })
}
