import { parseArgs } from 'node:util'
import { boosterTiers, createDatabase, drawableCharacters } from '@gachanime/db'
import { seededRng, simulateEconomy } from '@gachanime/game'
import { rateWeightsSchema } from '@gachanime/shared'
import { asc, count, eq, isNotNull } from 'drizzle-orm'
import { listAdminRarities } from '../admin/economy'
import { cliArgs } from './args'

/**
 * Economy check against the real catalog (GAME_DESIGN §3): a player opening only free boosters,
 * recycling every duplicate, with a fixed mission income. Prints gems per day over time and how
 * long each paid booster takes to afford.
 */
const { values } = parseArgs({
  args: cliArgs(),
  options: {
    days: { type: 'string', default: '90' },
    'free-per-day': { type: 'string', default: '25' },
    'other-per-day': { type: 'string', default: '230' },
    seed: { type: 'string', default: '1' },
  },
})
const days = Number(values.days)
const freePerDay = Number(values['free-per-day'])
const otherPerDay = Number(values['other-per-day'])
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl || ![days, freePerDay, otherPerDay].every(Number.isInteger)) {
  console.error(
    'Usage: pnpm economy:simulate -- [--days 90] [--free-per-day 25] [--other-per-day 230] [--seed 1]',
  )
  process.exit(1)
}

const { db, pool } = createDatabase(databaseUrl, { max: 2 })
try {
  const rarityRows = await listAdminRarities(db)
  const [free] = await db.select().from(boosterTiers).where(eq(boosterTiers.key, 'free'))
  if (!free) throw new Error('Free tier not found: run pnpm db:migrate')
  const poolRows = await db
    .select({ rarityId: drawableCharacters.rarityId, value: count() })
    .from(drawableCharacters)
    .groupBy(drawableCharacters.rarityId)
  const rarityIds = await db.query.rarities.findMany({ columns: { id: true, key: true } })
  const keyById = new Map(rarityIds.map((rarity) => [rarity.id, rarity.key]))
  const poolSizes = Object.fromEntries(
    poolRows.map((row) => [keyById.get(row.rarityId)!, row.value]),
  )
  const paid = await db
    .select({ key: boosterTiers.key, price: boosterTiers.priceGems })
    .from(boosterTiers)
    .where(isNotNull(boosterTiers.priceGems))
    .orderBy(asc(boosterTiers.sortOrder))

  const result = simulateEconomy({
    rarityOrder: rarityRows.map((rarity) => rarity.key),
    poolSizes,
    weights: rateWeightsSchema.parse(free.weights),
    recycleValues: Object.fromEntries(
      rarityRows.map((rarity) => [rarity.key, rarity.recycleValue]),
    ),
    days,
    freeBoostersPerDay: freePerDay,
    otherGemsPerDay: otherPerDay,
    rng: seededRng(Number(values.seed)),
  })

  console.log(`Catalog: ${JSON.stringify(poolSizes)}`)
  console.log(`${freePerDay} free boosters/day, ${otherPerDay} other gems/day, ${days} days\n`)
  console.log('day  recycle gems/day  total gems  distinct owned')
  const checkpoints = new Set([1, 2, 3, 7, 14, 30, 60, 90, 180, 365, days])
  for (const day of result.filter((entry) => checkpoints.has(entry.day))) {
    console.log(
      `${String(day.day).padStart(3)}  ${String(day.recycleGems).padStart(16)}  ${String(day.totalGems).padStart(10)}  ${String(day.distinctOwned).padStart(14)}`,
    )
  }
  const last = result.at(-1)!
  const window = result.slice(-7)
  const recentDaily =
    window.reduce((sum, day) => sum + day.recycleGems, 0) / window.length + otherPerDay
  console.log(`\nIncome over the last 7 days: ${recentDaily.toFixed(0)} gems/day`)
  for (const tier of paid) {
    const firstDay = result.find((day) => day.totalGems >= tier.price!)?.day
    console.log(
      `${tier.key.padEnd(10)} ${String(tier.price).padStart(6)} gems: first affordable on day ${firstDay ?? '-'}, then every ${(tier.price! / recentDaily).toFixed(1)} days`,
    )
  }
  console.log(`\nTotal after ${last.day} days (nothing spent): ${last.totalGems} gems`)
} finally {
  await pool.end()
}
