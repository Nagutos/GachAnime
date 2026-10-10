import { themes, type Database, type Executor } from '@gachanime/db'
import { boostWeights, WEEK_MS, weekStartUtc, type RateWeights } from '@gachanime/game'
import {
  themeRuleSchema,
  WEEKLY_SLOTS,
  type SettingValue,
  type ThemeRule,
  type WeeklyInfo,
  type WeeklySlot,
} from '@gachanime/shared'
import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'
import type { GameClock } from '../boosters/boosters'
import { getCatalogVersion } from '../catalog/drawable-pool'
import { cryptoRng } from '../random'
import { getSetting } from '../settings'
import { rebuildThemePool } from './pools'

type WeeklySettings = SettingValue<'boosters.weekly'>

/** Seal of every weekly pack: 週, "week". */
export const WEEKLY_SEAL = '週'

/** Pack colors of the weekly packs, one picked at random for each. */
const WEEKLY_COLORS = ['#f5b942', '#ff5d8f', '#4fb3ff', '#b06bff', '#3ddc97', '#ff7a45']

/** Transaction-scoped advisory lock: one rotation at a time across processes. */
const ROTATION_LOCK = 724_031

interface Candidate {
  /** Genre or tag name, or series id. */
  value: string
  label: string
}

/** The value a weekly pack was built from (to avoid picking it again soon). */
function ruleValue(rule: ThemeRule): string | null {
  const inner = rule.type === 'group' ? rule.rules[0] : rule
  if (!inner) return null
  if (inner.type === 'genre') return inner.genre
  if (inner.type === 'tag') return inner.tag
  if (inner.type === 'series') return String(inner.seriesIds[0])
  return null
}

function slotRule(slot: WeeklySlot, value: string, settings: WeeklySettings): ThemeRule {
  const rule: ThemeRule =
    slot === 'genre'
      ? { type: 'genre', genre: value }
      : slot === 'tag'
        ? { type: 'tag', tag: value, minRank: settings.tagMinRank }
        : { type: 'series', seriesIds: [Number(value)] }
  return { type: 'group', mode: 'all', rules: [rule] }
}

/**
 * Values with at least `minCharacters` drawable characters, matched exactly like the pack rules
 * (`themeRuleSql`): genres of active series and their media, tags of their media from
 * `tagMinRank` (adult tags left out), the most popular active series.
 */
async function loadCandidates(
  db: Executor,
  slot: WeeklySlot,
  settings: WeeklySettings,
): Promise<Candidate[]> {
  const min = settings.minCharacters
  const query = {
    genre: sql`
      SELECT x.value, x.value AS label
      FROM drawable_characters d
      JOIN series_characters sc ON sc.character_id = d.character_id
      JOIN series s ON s.id = sc.series_id AND s.is_active
      CROSS JOIN LATERAL (
        SELECT unnest(s.genres) UNION SELECT unnest(m.genres) FROM media m WHERE m.series_id = s.id
      ) AS x(value)
      GROUP BY x.value
      HAVING count(DISTINCT d.character_id) >= ${min}
      ORDER BY x.value`,
    tag: sql`
      SELECT min(t.name) AS value, min(t.name) AS label
      FROM drawable_characters d
      JOIN series_characters sc ON sc.character_id = d.character_id
      JOIN series s ON s.id = sc.series_id AND s.is_active
      JOIN media m ON m.series_id = s.id
      JOIN media_tags mt ON mt.media_id = m.id AND mt.rank >= ${settings.tagMinRank}
      JOIN anilist_tags t ON t.id = mt.tag_id AND NOT t.is_adult
      GROUP BY lower(t.name)
      HAVING count(DISTINCT d.character_id) >= ${min}
      ORDER BY 1`,
    series: sql`
      SELECT s.id::text AS value, s.title AS label
      FROM (SELECT id, title FROM series WHERE is_active
        ORDER BY popularity DESC, id LIMIT ${settings.topSeries}) s
      JOIN series_characters sc ON sc.series_id = s.id
      JOIN drawable_characters d ON d.character_id = sc.character_id
      GROUP BY s.id, s.title
      HAVING count(DISTINCT d.character_id) >= ${min}
      ORDER BY s.id`,
  }[slot]
  const result = await db.execute<{ value: string; label: string }>(query)
  return result.rows.filter((row) => row.value)
}

/** Values of this slot used in the previous `cooldownWeeks` weeks. */
async function recentValues(
  db: Executor,
  slot: WeeklySlot,
  from: Date,
  cooldownWeeks: number,
): Promise<Set<string>> {
  if (cooldownWeeks === 0) return new Set()
  const rows = await db
    .select({ rules: themes.rules })
    .from(themes)
    .where(
      and(
        eq(themes.weeklySlot, slot),
        gte(themes.weeklyFrom, new Date(from.getTime() - cooldownWeeks * WEEK_MS)),
        lt(themes.weeklyFrom, from),
      ),
    )
  return new Set(rows.flatMap((row) => ruleValue(themeRuleSchema.parse(row.rules)) ?? []))
}

/**
 * Slots found without any candidate, per week, catalog version and settings: the candidate
 * queries scan the catalog, so an empty catalog is not scanned again on every shop visit.
 */
const exhausted = new Map<WeeklySlot, string>()

/**
 * Weekly rotation (GAME_DESIGN §5): retires the packs of past weeks and picks the missing packs
 * of the current week. Idempotent and safe to call often (shop visits, worker job): the common
 * case is one small query.
 */
export async function ensureWeeklyThemes(database: Database, clock: GameClock = {}): Promise<void> {
  const now = clock.now ?? new Date()
  const rng = clock.rng ?? cryptoRng
  const from = weekStartUtc(now)
  const settings = await getSetting(database, 'boosters.weekly')
  const rows = await database
    .select({ slot: themes.weeklySlot, from: themes.weeklyFrom, isActive: themes.isActive })
    .from(themes)
    .where(isNotNull(themes.weeklySlot))
  const isCurrent = (row: (typeof rows)[number]) => row.from?.getTime() === from.getTime()
  const stale = rows.some((row) => row.isActive && (!settings.enabled || !isCurrent(row)))
  const memoKey = [
    from.toISOString(),
    await getCatalogVersion(database),
    JSON.stringify(settings),
  ].join('|')
  const missing = settings.enabled
    ? WEEKLY_SLOTS.filter(
        (slot) =>
          !rows.some((row) => row.slot === slot && isCurrent(row)) &&
          exhausted.get(slot) !== memoKey,
      )
    : []
  if (!stale && missing.length === 0) return

  await database.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ROTATION_LOCK})`)
    // Past weeks (or every weekly pack when disabled): out of the shop, their pools dropped.
    const retired = await tx
      .update(themes)
      .set({ isActive: false })
      .where(
        and(
          isNotNull(themes.weeklySlot),
          eq(themes.isActive, true),
          settings.enabled ? sql`${themes.weeklyFrom} <> ${from}` : sql`TRUE`,
        ),
      )
      .returning({ id: themes.id })
    for (const { id } of retired) {
      await tx.execute(sql`DELETE FROM theme_characters WHERE theme_id = ${id}`)
    }

    for (const slot of missing) {
      const [existing] = await tx
        .select({ id: themes.id })
        .from(themes)
        .where(and(eq(themes.weeklySlot, slot), eq(themes.weeklyFrom, from)))
      if (existing) continue
      const candidates = await loadCandidates(tx, slot, settings)
      const recent = await recentValues(tx, slot, from, settings.cooldownWeeks)
      const fresh = candidates.filter((candidate) => !recent.has(candidate.value))
      const pool = fresh.length ? fresh : candidates
      if (pool.length === 0) {
        exhausted.set(slot, memoKey)
        continue
      }
      const picked = pool[rng.nextInt(pool.length)]!
      const [created] = await tx
        .insert(themes)
        .values({
          key: `weekly-${slot}-${from.toISOString().slice(0, 10)}`,
          category: slot === 'series' ? 'custom' : 'genre',
          name: { en: picked.label },
          description: null,
          rules: slotRule(slot, picked.value, settings),
          color: WEEKLY_COLORS[rng.nextInt(WEEKLY_COLORS.length)]!,
          seal: WEEKLY_SEAL,
          isActive: true,
          sortOrder: WEEKLY_SLOTS.indexOf(slot),
          weeklySlot: slot,
          weeklyFrom: from,
        })
        .onConflictDoNothing()
        .returning({ id: themes.id })
      if (created) await rebuildThemePool(tx, created.id)
    }
  })
}

/** Whether a weekly pack's week is over (`weeklyFrom` null: a regular pack, never over). */
export function weeklyThemeExpired(weeklyFrom: Date | null, now: Date): boolean {
  return weeklyFrom !== null && weeklyFrom.getTime() + WEEK_MS <= now.getTime()
}

/** The free tier's rates for the weekly packs. */
export function weeklyWeights(
  weights: RateWeights,
  rarityOrder: string[],
  settings: WeeklySettings,
): RateWeights {
  return boostWeights(weights, rarityOrder, settings.boostedFrom, settings.rareMultiplier)
}

export function weeklyInfo(slot: WeeklySlot, weeklyFrom: Date, weights: RateWeights): WeeklyInfo {
  return {
    slot,
    startsAt: weeklyFrom.toISOString(),
    endsAt: new Date(weeklyFrom.getTime() + WEEK_MS).toISOString(),
    weights,
  }
}
