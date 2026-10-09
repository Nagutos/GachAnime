import { previewRecycleDuplicates, recycleAllDuplicates } from '@gachanime/core'
import { booleanQuery, rarityKeySchema, recycleDuplicatesRequestSchema } from '@gachanime/shared'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { parseJsonBody, parseQuery } from '@/lib/http'
import { withIdempotency } from '@/lib/idempotency'
import { playerRoute } from '@/lib/player'

/** `?rarities=common,rare&includeFavorites=true` */
const previewQuerySchema = z.object({
  includeFavorites: booleanQuery,
  rarities: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : undefined))
    .pipe(z.array(rarityKeySchema).max(20).optional()),
})

export const GET = playerRoute(async ({ request, user }) =>
  Response.json(
    await previewRecycleDuplicates(getDb(), user.id, parseQuery(request, previewQuerySchema)),
  ),
)

export const POST = playerRoute(async ({ request, user }) => {
  const body = await parseJsonBody(request, recycleDuplicatesRequestSchema)
  return Response.json(
    await withIdempotency(request, user.id, () => recycleAllDuplicates(getDb(), user.id, body)),
  )
}, 'economy')
