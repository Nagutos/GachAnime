import { browseListings, createListing, getMe } from '@gachanime/core'
import { createListingSchema, marketQuerySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody, parseQuery } from '@/lib/http'
import { withIdempotency } from '@/lib/idempotency'
import { playerRoute } from '@/lib/player'

export const GET = playerRoute(async ({ request, user }) =>
  Response.json(await browseListings(getDb(), user.id, parseQuery(request, marketQuerySchema))),
)

export const POST = playerRoute(async ({ request, user }) => {
  const body = await parseJsonBody(request, createListingSchema)
  const result = await withIdempotency(request, user.id, async () => {
    const { listing, progression } = await createListing(getDb(), user.id, body)
    return { listing, progression, gemBalance: (await getMe(getDb(), user.id)).gemBalance }
  })
  return Response.json(result, { status: 201 })
}, 'economy')
