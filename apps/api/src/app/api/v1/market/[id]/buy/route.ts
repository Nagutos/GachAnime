import { buyListing } from '@gachanime/core'
import { getDb } from '@/lib/db'
import { parseId } from '@/lib/http'
import { withIdempotency } from '@/lib/idempotency'
import { playerRoute } from '@/lib/player'

export const POST = playerRoute<{ id: string }>(
  async ({ request, user, params }) =>
    Response.json(
      await withIdempotency(request, user.id, () =>
        buyListing(getDb(), user.id, parseId(params.id)),
      ),
    ),
  'economy',
)
