import type { AdminActor } from '@gachanime/core'
import { AppError } from '@gachanime/core'
import { IMAGE_UPLOAD_MAX_BYTES } from '@gachanime/shared'
import { route } from './http'
import { enforceRateLimit, type RateLimitPolicy } from './rate-limit'
import { requireAdmin } from './session'

export { parseId, parseQuery } from './http'

/** Client IP as forwarded by Caddy (first hop), for the audit log. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
}

type AdminHandler<P> = (input: {
  request: Request
  actor: AdminActor
  params: P
}) => Promise<Response>

/**
 * Admin route: checks the admin role server-side, applies the admin rate limit, resolves the
 * dynamic route params and provides the actor for the audit log.
 */
export function adminRoute<P = Record<string, never>>(
  handler: AdminHandler<P>,
  policy: RateLimitPolicy = 'admin',
) {
  return route<{ params: Promise<P> }>(async (request, context) => {
    const user = await requireAdmin(request)
    await enforceRateLimit(policy, user.id)
    const params = (await context?.params) ?? ({} as P)
    return handler({ request, actor: { actorId: user.id, ip: clientIp(request) }, params })
  })
}

/** Room for the multipart boundaries and headers around the file itself. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024

/** Reads the `file` field of a multipart upload, refusing oversized bodies before parsing. */
export async function readUploadedFile(request: Request): Promise<Uint8Array> {
  const length = Number(request.headers.get('content-length') ?? Number.NaN)
  if (Number.isFinite(length) && length > IMAGE_UPLOAD_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) {
    throw new AppError('INVALID_IMAGE', 'Image is too large')
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new AppError('BAD_REQUEST', 'Expected a multipart/form-data body')
  }
  const file = form.get('file')
  if (!(file instanceof File)) throw new AppError('BAD_REQUEST', 'Missing "file" field')
  return new Uint8Array(await file.arrayBuffer())
}
