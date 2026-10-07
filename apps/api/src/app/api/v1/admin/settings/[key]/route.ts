import { AppError, getAdminSettings, isSettingKey, updateSetting } from '@gachanime/core'
import { z } from 'zod'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { parseJsonBody } from '@/lib/http'

/** Body: the new value of the setting (validated by its schema in the service). */
export const PUT = adminRoute<{ key: string }>(async ({ request, actor, params }) => {
  if (!isSettingKey(params.key)) throw new AppError('NOT_FOUND', `Unknown setting "${params.key}"`)
  await updateSetting(getDb(), params.key, await parseJsonBody(request, z.unknown()), actor)
  return Response.json(await getAdminSettings(getDb()))
})
