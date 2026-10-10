import { AppError, buyUpgrade } from '@gachanime/core'
import { buyUpgradeRequestSchema, upgradeKeySchema } from '@gachanime/shared'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'
import { playerRoute } from '@/lib/player'

type Params = { key: string }

export const POST = playerRoute<Params>(async ({ request, user, params }) => {
  const key = upgradeKeySchema.safeParse(params.key)
  if (!key.success) throw new AppError('NOT_FOUND', `Upgrade "${params.key}" not found`)
  const body = await parseJsonBody(request, buyUpgradeRequestSchema)
  return Response.json(await buyUpgrade(getDb(), user.id, key.data, body))
}, 'economy')
