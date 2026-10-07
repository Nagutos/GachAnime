import { updateRarity } from '@gachanime/core'
import { updateRaritySchema } from '@gachanime/shared'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

export const PATCH = adminRoute<{ key: string }>(async ({ request, actor, params }) =>
  Response.json(
    await updateRarity(
      getDb(),
      params.key,
      await parseJsonBody(request, updateRaritySchema),
      actor,
    ),
  ),
)
