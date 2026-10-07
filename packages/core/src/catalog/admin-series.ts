import {
  characters,
  media,
  rarities,
  series,
  seriesCharacters,
  type Database,
  type Executor,
} from '@gachanime/db'
import type {
  AdminSeriesDetail,
  AdminSeriesItem,
  AdminSeriesQuery,
  CreateManualSeriesRequest,
  MergeSeriesRequest,
  Paginated,
  SplitSeriesRequest,
  UpdateSeriesRequest,
} from '@gachanime/shared'
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import { recordAdminAction } from '../admin/audit'
import { AppError } from '../errors'
import { publicImageUrl } from './images'
import {
  rebuildSeriesCharacters,
  refreshAniListSeries,
  uniqueSeriesSlug,
} from './series-maintenance'

/** Who performs an admin action (audit log). */
export interface AdminActor {
  actorId: string
  ip?: string | null
}

/** `%value%` with LIKE wildcards escaped. */
export function containsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

// Correlated subqueries name the outer column explicitly: Drizzle renders `${series.id}` as an
// unqualified "id", which would resolve to the inner table.
const mediaCount = sql<number>`(SELECT count(*)::int FROM media m WHERE m.series_id = "series"."id")`
const characterCount = sql<number>`(SELECT count(*)::int FROM series_characters sc WHERE sc.series_id = "series"."id")`

const seriesItemColumns = {
  id: series.id,
  slug: series.slug,
  kind: series.kind,
  source: series.source,
  title: series.title,
  titleEnglish: series.titleEnglish,
  coverUrl: series.coverUrl,
  coverUploadPath: series.coverUploadPath,
  isActive: series.isActive,
  popularity: series.popularity,
  mediaCount,
  characterCount,
}

const selectSeriesItems = (db: Executor) => db.select(seriesItemColumns).from(series)
type SeriesItemRow = Awaited<ReturnType<typeof selectSeriesItems>>[number]

function toSeriesItem(row: SeriesItemRow): AdminSeriesItem {
  const { coverUploadPath, ...rest } = row
  return { ...rest, coverUrl: publicImageUrl(coverUploadPath, row.coverUrl) }
}

export async function listSeries(
  db: Executor,
  query: AdminSeriesQuery,
): Promise<Paginated<AdminSeriesItem>> {
  const conditions: SQL[] = []
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(or(ilike(series.title, pattern), ilike(series.titleEnglish, pattern))!)
  }
  if (query.kind) conditions.push(eq(series.kind, query.kind))
  if (query.source) conditions.push(eq(series.source, query.source))
  if (query.active !== undefined) conditions.push(eq(series.isActive, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  const [rows, [total]] = await Promise.all([
    selectSeriesItems(db)
      .where(where)
      .orderBy(desc(series.popularity), asc(series.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(series).where(where),
  ])
  return {
    items: rows.map(toSeriesItem),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

async function findSeries(db: Executor, id: number, lock = false) {
  const query = db.select().from(series).where(eq(series.id, id))
  const [row] = lock ? await query.for('update') : await query
  if (!row) throw new AppError('NOT_FOUND', `Series #${id} not found`)
  return row
}

export async function getSeriesDetail(db: Executor, id: number): Promise<AdminSeriesDetail> {
  const row = await findSeries(db, id)
  const [[item], mediaRows, rarityRows] = await Promise.all([
    selectSeriesItems(db).where(eq(series.id, id)),
    db
      .select({
        id: media.id,
        anilistId: media.anilistId,
        format: media.format,
        titleRomaji: media.titleRomaji,
        titleEnglish: media.titleEnglish,
        seasonYear: media.seasonYear,
        popularity: media.popularity,
        coverUrl: media.coverUrl,
        siteUrl: media.siteUrl,
        charactersSyncedAt: media.charactersSyncedAt,
        characterCount: sql<number>`(SELECT count(*)::int FROM character_media cm WHERE cm.media_id = "media"."id")`,
      })
      .from(media)
      .where(eq(media.seriesId, id))
      .orderBy(desc(media.popularity), asc(media.anilistId)),
    db
      .select({ key: rarities.key, value: count() })
      .from(seriesCharacters)
      .innerJoin(characters, eq(characters.id, seriesCharacters.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .where(eq(seriesCharacters.seriesId, id))
      .groupBy(rarities.key),
  ])
  return {
    ...toSeriesItem(item!),
    description: row.description,
    genres: row.genres,
    primaryMediaId: row.primaryMediaId,
    media: mediaRows.map((item) => ({
      ...item,
      charactersSyncedAt: item.charactersSyncedAt?.toISOString() ?? null,
    })),
    rarityCounts: Object.fromEntries(rarityRows.map((rarity) => [rarity.key, rarity.value])),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function assertSlugFree(db: Executor, slug: string, exceptId?: number): Promise<void> {
  const [taken] = await db
    .select({ id: series.id })
    .from(series)
    .where(exceptId ? and(eq(series.slug, slug), ne(series.id, exceptId)) : eq(series.slug, slug))
  if (taken) throw new AppError('CONFLICT', `The slug "${slug}" is already used`)
}

export async function createManualSeries(
  database: Database,
  input: CreateManualSeriesRequest,
  actor: AdminActor,
): Promise<{ id: number }> {
  return database.transaction(async (tx) => {
    await assertSlugFree(tx, input.slug)
    const [created] = await tx
      .insert(series)
      .values({
        slug: input.slug,
        kind: input.kind,
        source: 'manual',
        title: input.title,
        titleEnglish: input.titleEnglish ?? null,
        description: input.description ?? null,
        coverUrl: input.coverUrl ?? null,
        genres: input.genres ?? [],
      })
      .returning()
    await recordAdminAction(tx, {
      ...actor,
      action: 'series.create',
      targetType: 'series',
      targetId: String(created!.id),
      after: created,
    })
    return { id: created!.id }
  })
}

export async function updateSeries(
  database: Database,
  id: number,
  input: UpdateSeriesRequest,
  actor: AdminActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    const before = await findSeries(tx, id, true)
    const { isActive, ...manualFields } = input
    const editsContent = Object.values(manualFields).some((value) => value !== undefined)
    if (editsContent && before.source !== 'manual') {
      throw new AppError('NOT_MANUAL_ENTRY', 'AniList series only support activation changes')
    }
    if (input.slug) await assertSlugFree(tx, input.slug, id)

    const [after] = await tx
      .update(series)
      .set({
        ...(isActive === undefined ? {} : { isActive }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.titleEnglish === undefined ? {} : { titleEnglish: input.titleEnglish }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.coverUrl === undefined ? {} : { coverUrl: input.coverUrl }),
        ...(input.genres === undefined ? {} : { genres: input.genres }),
      })
      .where(eq(series.id, id))
      .returning()
    await recordAdminAction(tx, {
      ...actor,
      action: editsContent ? 'series.update' : isActive ? 'series.activate' : 'series.deactivate',
      targetType: 'series',
      targetId: String(id),
      before,
      after,
    })
  })
}

/**
 * Deletes a series with its media and memberships. Characters are kept (players may own them);
 * an AniList series comes back on the next import that reaches it.
 */
export async function deleteSeries(
  database: Database,
  id: number,
  actor: AdminActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    const before = await findSeries(tx, id, true)
    await tx.delete(series).where(eq(series.id, id))
    await recordAdminAction(tx, {
      ...actor,
      action: 'series.delete',
      targetType: 'series',
      targetId: String(id),
      before,
    })
  })
}

/** Moves the media (AniList) or members (manual) of `sourceIds` into `targetId`, then deletes them. */
export async function mergeSeries(
  database: Database,
  input: MergeSeriesRequest,
  actor: AdminActor,
): Promise<void> {
  const sourceIds = [...new Set(input.sourceIds)].filter((id) => id !== input.targetId)
  if (sourceIds.length === 0) throw new AppError('VALIDATION_FAILED', 'Nothing to merge')

  await database.transaction(async (tx) => {
    const ordered = [input.targetId, ...sourceIds].sort((a, b) => a - b)
    const rows = await tx
      .select()
      .from(series)
      .where(inArray(series.id, ordered))
      .orderBy(asc(series.id))
      .for('update')
    const target = rows.find((row) => row.id === input.targetId)
    if (!target || rows.length !== ordered.length)
      throw new AppError('NOT_FOUND', 'Series not found')
    if (rows.some((row) => row.source !== target.source)) {
      throw new AppError('CONFLICT', 'Only series from the same source can be merged')
    }

    await tx.update(media).set({ seriesId: target.id }).where(inArray(media.seriesId, sourceIds))
    if (target.source === 'manual') {
      await tx.execute(sql`
        INSERT INTO series_characters (series_id, character_id)
        SELECT ${target.id}, character_id FROM series_characters WHERE series_id IN ${sourceIds}
        ON CONFLICT DO NOTHING`)
    }
    await tx.delete(series).where(inArray(series.id, sourceIds))
    if (target.source === 'anilist') {
      await rebuildSeriesCharacters(tx, [target.id])
      await refreshAniListSeries(tx, [target.id])
    }
    await recordAdminAction(tx, {
      ...actor,
      action: 'series.merge',
      targetType: 'series',
      targetId: String(target.id),
      before: rows,
      after: { targetId: target.id, mergedIds: sourceIds },
    })
  })
}

/** Moves some media of an AniList series into a new series. Returns the new series id. */
export async function splitSeries(
  database: Database,
  id: number,
  input: SplitSeriesRequest,
  actor: AdminActor,
): Promise<{ id: number }> {
  return database.transaction(async (tx) => {
    const source = await findSeries(tx, id, true)
    if (source.source !== 'anilist') {
      throw new AppError('CONFLICT', 'Only AniList series can be split')
    }
    const all = await tx
      .select({
        id: media.id,
        anilistId: media.anilistId,
        title: media.titleRomaji,
        popularity: media.popularity,
      })
      .from(media)
      .where(eq(media.seriesId, id))
    const moving = all.filter((item) => input.mediaIds.includes(item.id))
    if (moving.length !== new Set(input.mediaIds).size) {
      throw new AppError('VALIDATION_FAILED', 'Some media do not belong to this series')
    }
    if (moving.length === all.length) {
      throw new AppError('VALIDATION_FAILED', 'At least one media must stay in the series')
    }

    const primary = [...moving].sort((a, b) => b.popularity - a.popularity)[0]!
    const slug = await uniqueSeriesSlug(tx, primary.title, `anilist-${primary.anilistId}`)
    const [created] = await tx
      .insert(series)
      .values({
        slug,
        kind: source.kind,
        source: 'anilist',
        title: primary.title,
        isActive: source.isActive,
      })
      .returning({ id: series.id })
    await tx
      .update(media)
      .set({ seriesId: created!.id })
      .where(
        inArray(
          media.id,
          moving.map((item) => item.id),
        ),
      )
    await rebuildSeriesCharacters(tx, [id, created!.id])
    await refreshAniListSeries(tx, [id, created!.id])
    await recordAdminAction(tx, {
      ...actor,
      action: 'series.split',
      targetType: 'series',
      targetId: String(id),
      after: { newSeriesId: created!.id, mediaIds: moving.map((item) => item.id) },
    })
    return { id: created!.id }
  })
}

/** Stores an uploaded cover path on a manual series; returns the previous path to delete. */
export async function setSeriesCover(
  database: Database,
  id: number,
  coverUploadPath: string,
  actor: AdminActor,
): Promise<{ previousPath: string | null }> {
  return database.transaction(async (tx) => {
    const before = await findSeries(tx, id, true)
    if (before.source !== 'manual') {
      throw new AppError('NOT_MANUAL_ENTRY', 'Only manual series have uploaded covers')
    }
    await tx.update(series).set({ coverUploadPath }).where(eq(series.id, id))
    await recordAdminAction(tx, {
      ...actor,
      action: 'series.cover',
      targetType: 'series',
      targetId: String(id),
      before: { coverUploadPath: before.coverUploadPath },
      after: { coverUploadPath },
    })
    return { previousPath: before.coverUploadPath }
  })
}
