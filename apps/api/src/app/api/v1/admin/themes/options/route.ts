import { getThemeRuleOptions } from '@gachanime/core'
import { adminRoute } from '@/lib/admin'
import { getDb } from '@/lib/db'

export const GET = adminRoute(async () => Response.json(await getThemeRuleOptions(getDb())))
