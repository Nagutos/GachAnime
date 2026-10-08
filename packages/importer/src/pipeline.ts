import {
  RarityTable,
  rebuildSeriesCharacters,
  refreshAniListSeries,
  uniqueSeriesSlug,
} from '@gachanime/core'
import {
  anilistTags,
  characterMedia,
  characters,
  importJobs,
  media,
  mediaTags,
  series,
  type Database,
  type Executor,
} from '@gachanime/db'
import {
  importParamsSchema,
  importProgressSchema,
  type ImportParams,
  type ImportProgress,
} from '@gachanime/shared'
import { and, eq, gte, inArray, isNull, lt, notInArray, or, sql } from 'drizzle-orm'
import { fetchMediaBatch, fetchMediaCharactersPage, fetchTopMediaIds } from './anilist/api'
import { silentLogger, type AniListClient, type ImportLogger } from './anilist/client'
import { MEDIA_BATCH_SIZE, type AniListCharacterConnection } from './anilist/queries'
import { assignSeries, groupFranchises } from './franchise'
import type { IgdbClient } from './igdb/client'
import { IgdbImportRun } from './igdb/pipeline'
import { ImportCancelled } from './job'
import {
  isImportableMedia,
  toCharacterAppearances,
  toMediaRow,
  toTagRows,
  type CharacterAppearance,
} from './mapping'

/** Safety net against relation chains that would pull a large part of AniList. */
export const MAX_DISCOVERED_MEDIA = 15_000
/** Safety net against a media with an endless character list. */
const MAX_CHARACTER_PAGES = 400

export interface ImportDependencies {
  db: Database
  client: AniListClient
  /** Null when the instance has no IGDB credentials: IGDB jobs then fail with a clear error. */
  igdb?: IgdbClient | null
  logger?: ImportLogger
}

export type ImportOutcome = 'completed' | 'cancelled' | 'skipped'

type AniListParams = Extract<ImportParams, { mode: 'top' | 'ids' }>

/** `excluded.<column>` in an `ON CONFLICT DO UPDATE` clause. */
const excluded = (column: string) => sql.raw(`excluded.${column}`)

/**
 * Runs (or resumes) an import job: an AniList import (`ImportRun`) or an IGDB one
 * (`IgdbImportRun`). The job row tracks status and progress; a cancelled job keeps its progress.
 */
export async function runImportJob(
  deps: ImportDependencies,
  jobId: number,
): Promise<ImportOutcome> {
  const { db } = deps
  const logger = deps.logger ?? silentLogger

  const [job] = await db
    .update(importJobs)
    .set({
      status: 'running',
      startedAt: sql`coalesce(${importJobs.startedAt}, now())`,
      error: null,
    })
    .where(and(eq(importJobs.id, jobId), inArray(importJobs.status, ['queued', 'running'])))
    .returning()
  if (!job) {
    logger.warn({ jobId }, 'import job is not queued, skipping')
    return 'skipped'
  }

  const params = importParamsSchema.parse(job.params)
  let run: ImportRun | IgdbImportRun | null = null
  try {
    run = createRun(deps, logger, job.id, params, job.startedAt!)
    run.progress = importProgressSchema.parse(job.progress)
    await run.execute()
    await db
      .update(importJobs)
      .set({ status: 'completed', finishedAt: new Date(), progress: run.progress })
      .where(eq(importJobs.id, jobId))
    logger.info({ jobId, ...run.summary() }, 'import completed')
    return 'completed'
  } catch (error) {
    const progress = run?.progress ?? job.progress
    if (error instanceof ImportCancelled) {
      await db.update(importJobs).set({ progress }).where(eq(importJobs.id, jobId))
      logger.info({ jobId }, 'import cancelled')
      return 'cancelled'
    }
    await db
      .update(importJobs)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
        progress,
      })
      .where(and(eq(importJobs.id, jobId), eq(importJobs.status, 'running')))
    throw error
  }
}

function createRun(
  deps: ImportDependencies,
  logger: ImportLogger,
  jobId: number,
  params: ImportParams,
  startedAt: Date,
): ImportRun | IgdbImportRun {
  if (params.mode === 'igdb_top' || params.mode === 'igdb_ids') {
    if (!deps.igdb) {
      throw new Error('IGDB is not configured: set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET')
    }
    return new IgdbImportRun(deps.db, deps.igdb, logger, jobId, params, startedAt)
  }
  return new ImportRun(deps, logger, jobId, params, startedAt)
}

/**
 * AniList import:
 * 1. discover — seeds (top N or ids), then their franchises through relations; media, tags and the
 *    first page of characters are stored as they arrive;
 * 2. group — franchise components become series (existing assignments are kept);
 * 3. characters — remaining character pages of every media not synced during this job;
 * 4. finalize — series membership and metadata.
 * Data fetched since the job first started is not fetched again when it resumes.
 */
class ImportRun {
  progress: ImportProgress = importProgressSchema.parse({})
  private rarities!: RarityTable
  private readonly requestsAtStart: number

  constructor(
    private readonly deps: ImportDependencies,
    private readonly logger: ImportLogger,
    private readonly jobId: number,
    private readonly params: AniListParams,
    /** Rows fetched or synced at or after this instant are fresh for this job. */
    private readonly freshSince: Date,
  ) {
    this.requestsAtStart = deps.client.requestCount
  }

  private get db(): Database {
    return this.deps.db
  }

  summary() {
    return importProgressSchema
      .omit({ mediaAnilistIds: true, gameIgdbIds: true })
      .parse(this.progress)
  }

  async execute(): Promise<void> {
    this.rarities = await RarityTable.load(this.db)
    const baseRequests = this.progress.requests
    const countRequests = () => {
      this.progress.requests = baseRequests + this.deps.client.requestCount - this.requestsAtStart
    }

    if (this.progress.phase === 'discover') {
      await this.discover(countRequests)
      this.progress.phase = 'group'
      await this.saveProgress()
    }
    if (this.progress.phase === 'group') {
      await this.group()
      this.progress.phase = 'characters'
      await this.saveProgress()
    }
    if (this.progress.phase === 'characters') {
      await this.syncCharacters(countRequests)
      this.progress.phase = 'finalize'
      await this.saveProgress()
    }
    if (this.progress.phase === 'finalize') {
      await this.finalize()
      this.progress.phase = 'done'
    }
  }

  // ─── 1. Discovery ──────────────────────────────────────────────────────────

  private async discover(countRequests: () => void): Promise<void> {
    const seeds =
      this.params.mode === 'top'
        ? await fetchTopMediaIds(this.deps.client, this.params.top)
        : [...new Set(this.params.anilistIds)]
    this.progress.seedCount = seeds.length
    countRequests()
    this.logger.info({ jobId: this.jobId, seeds: seeds.length }, 'import discovery started')

    const queue = [...seeds]
    const queued = new Set(seeds)
    const discovered: number[] = []

    while (queue.length > 0) {
      await this.assertNotCancelled()
      const batch = queue.splice(0, MEDIA_BATCH_SIZE)

      // Media already fetched by this job (resume): reuse their stored relations.
      const fresh = await this.db
        .select({ anilistId: media.anilistId, relations: media.franchiseRelations })
        .from(media)
        .where(and(inArray(media.anilistId, batch), gte(media.fetchedAt, this.freshSince)))
      const relationsById = new Map(fresh.map((row) => [row.anilistId, row.relations]))
      const toFetch = batch.filter((id) => !relationsById.has(id))

      const fetched = await fetchMediaBatch(this.deps.client, toFetch)
      countRequests()
      for (const item of fetched) {
        if (!isImportableMedia(item)) continue
        const row = toMediaRow(item)
        await this.db.transaction(async (tx) => {
          const mediaId = await upsertMedia(tx, row)
          await replaceMediaTags(tx, mediaId, toTagRows(item))
          await this.storeFirstCharacterPage(tx, mediaId, item.characters)
        })
        relationsById.set(item.id, row.franchiseRelations)
      }

      for (const id of batch) {
        const relations = relationsById.get(id)
        if (!relations) continue // Unknown, adult or excluded media.
        discovered.push(id)
        if (!this.params.expandFranchise) continue
        for (const related of relations) {
          if (queued.has(related)) continue
          if (queued.size >= MAX_DISCOVERED_MEDIA) {
            this.logger.warn({ jobId: this.jobId }, 'discovery limit reached, franchise truncated')
            break
          }
          queued.add(related)
          queue.push(related)
        }
      }

      this.progress.mediaTotal = discovered.length
      await this.saveProgress()
    }

    this.progress.mediaAnilistIds = discovered
    this.progress.mediaTotal = discovered.length
  }

  /** Stores the first character page received with the media; a short list is then complete. */
  private async storeFirstCharacterPage(
    tx: Executor,
    mediaId: number,
    connection: AniListCharacterConnection,
  ): Promise<void> {
    const { appearances, skipped } = toCharacterAppearances(connection)
    const characterIds = await this.upsertAppearances(tx, mediaId, appearances)
    this.progress.charactersSkippedNoImage += skipped
    if (!connection.pageInfo.hasNextPage) await completeCharacterSync(tx, mediaId, characterIds)
  }

  // ─── 2. Grouping into series ───────────────────────────────────────────────

  private async group(): Promise<void> {
    await this.db.transaction(async (tx) => {
      const nodes = await tx
        .select({
          id: media.id,
          anilistId: media.anilistId,
          relations: media.franchiseRelations,
          popularity: media.popularity,
          seriesId: media.seriesId,
          titleRomaji: media.titleRomaji,
        })
        .from(media)
      const byAnilistId = new Map(nodes.map((node) => [node.anilistId, node]))

      const groups = groupFranchises(nodes.map((node) => ({ ...node, relations: node.relations })))
      const touched: number[] = []
      for (const group of groups) {
        const assignment = assignSeries(group)
        if (!assignment) continue
        let seriesId = assignment.seriesId
        if (seriesId === null) {
          const primary = byAnilistId.get(assignment.primaryAnilistId)!
          const slug = await uniqueSeriesSlug(
            tx,
            primary.titleRomaji,
            `anilist-${primary.anilistId}`,
          )
          const [created] = await tx
            .insert(series)
            .values({ slug, kind: 'anime', source: 'anilist', title: primary.titleRomaji })
            .returning({ id: series.id })
          seriesId = created!.id
          this.progress.seriesCreated += 1
        }
        await tx
          .update(media)
          .set({ seriesId })
          .where(and(inArray(media.anilistId, assignment.unassigned), isNull(media.seriesId)))
        touched.push(seriesId)
      }
      await refreshAniListSeries(tx, touched)
    })
  }

  // ─── 3. Characters ─────────────────────────────────────────────────────────

  private async syncCharacters(countRequests: () => void): Promise<void> {
    const ids = this.progress.mediaAnilistIds
    const pending = ids.length
      ? await this.db
          .select({ id: media.id, anilistId: media.anilistId })
          .from(media)
          .where(
            and(
              inArray(media.anilistId, ids),
              or(isNull(media.charactersSyncedAt), lt(media.charactersSyncedAt, this.freshSince)),
            ),
          )
          .orderBy(media.anilistId)
      : []
    this.progress.mediaCharactersDone = ids.length - pending.length
    await this.saveProgress()

    for (const item of pending) {
      await this.assertNotCancelled()
      const characterIds: number[] = []
      for (let page = 1; page <= MAX_CHARACTER_PAGES; page += 1) {
        const connection = await fetchMediaCharactersPage(this.deps.client, item.anilistId, page)
        countRequests()
        if (!connection) break
        const { appearances, skipped } = toCharacterAppearances(connection)
        this.progress.charactersSkippedNoImage += skipped
        characterIds.push(
          ...(await this.db.transaction((tx) => this.upsertAppearances(tx, item.id, appearances))),
        )
        if (!connection.pageInfo.hasNextPage) break
      }
      await this.db.transaction((tx) => completeCharacterSync(tx, item.id, characterIds))
      this.progress.mediaCharactersDone += 1
      await this.saveProgress()
    }
  }

  /** Upserts characters (rarity overrides are kept) and their role in the media. */
  private async upsertAppearances(
    tx: Executor,
    mediaId: number,
    appearances: CharacterAppearance[],
  ): Promise<number[]> {
    if (appearances.length === 0) return []
    const rows = await tx
      .insert(characters)
      .values(
        appearances.map(({ character }) => ({
          source: 'anilist' as const,
          ...character,
          rarityId: this.rarities.idForFavourites(character.favourites),
        })),
      )
      .onConflictDoUpdate({
        target: characters.anilistId,
        set: {
          nameFull: excluded('name_full'),
          nameNative: excluded('name_native'),
          nameAlternatives: excluded('name_alternatives'),
          description: excluded('description'),
          imageUrl: excluded('image_url'),
          genderRaw: excluded('gender_raw'),
          genderClass: excluded('gender_class'),
          favourites: excluded('favourites'),
          rarityId: sql`CASE WHEN ${characters.rarityOverridden} THEN ${characters.rarityId} ELSE excluded.rarity_id END`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: characters.id, anilistId: characters.anilistId })
    const idByAnilistId = new Map(rows.map((row) => [row.anilistId!, row.id]))

    await tx
      .insert(characterMedia)
      .values(
        appearances.map(({ character, role }) => ({
          characterId: idByAnilistId.get(character.anilistId)!,
          mediaId,
          role,
        })),
      )
      .onConflictDoUpdate({
        target: [characterMedia.characterId, characterMedia.mediaId],
        set: { role: excluded('role') },
      })
    this.progress.charactersUpserted += rows.length
    return rows.map((row) => row.id)
  }

  // ─── 4. Finalize ───────────────────────────────────────────────────────────

  private async finalize(): Promise<void> {
    const ids = this.progress.mediaAnilistIds
    if (ids.length === 0) return
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .selectDistinct({ seriesId: media.seriesId })
        .from(media)
        .where(inArray(media.anilistId, ids))
      const seriesIds = rows.map((row) => row.seriesId).filter((id): id is number => id !== null)
      await rebuildSeriesCharacters(tx, seriesIds)
      await refreshAniListSeries(tx, seriesIds)
    })
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async saveProgress(): Promise<void> {
    await this.db
      .update(importJobs)
      .set({ progress: this.progress })
      .where(eq(importJobs.id, this.jobId))
  }

  private async assertNotCancelled(): Promise<void> {
    const [row] = await this.db
      .select({ status: importJobs.status })
      .from(importJobs)
      .where(eq(importJobs.id, this.jobId))
    if (row?.status !== 'running') throw new ImportCancelled()
  }
}

async function upsertMedia(tx: Executor, row: ReturnType<typeof toMediaRow>): Promise<number> {
  const [result] = await tx
    .insert(media)
    .values(row)
    .onConflictDoUpdate({
      target: media.anilistId,
      set: {
        format: excluded('format'),
        titleRomaji: excluded('title_romaji'),
        titleEnglish: excluded('title_english'),
        titleNative: excluded('title_native'),
        description: excluded('description'),
        seasonYear: excluded('season_year'),
        popularity: excluded('popularity'),
        favourites: excluded('favourites'),
        isAdult: excluded('is_adult'),
        genres: excluded('genres'),
        coverUrl: excluded('cover_url'),
        siteUrl: excluded('site_url'),
        franchiseRelations: excluded('franchise_relations'),
        fetchedAt: sql`now()`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: media.id })
  return result!.id
}

async function replaceMediaTags(
  tx: Executor,
  mediaId: number,
  tags: ReturnType<typeof toTagRows>,
): Promise<void> {
  await tx.delete(mediaTags).where(eq(mediaTags.mediaId, mediaId))
  if (tags.length === 0) return
  const rows = await tx
    .insert(anilistTags)
    .values(
      tags.map((tag) => ({
        anilistId: tag.anilistId,
        name: tag.name,
        category: tag.category,
        isAdult: tag.isAdult,
      })),
    )
    .onConflictDoUpdate({
      target: anilistTags.anilistId,
      set: {
        name: excluded('name'),
        category: excluded('category'),
        isAdult: excluded('is_adult'),
      },
    })
    .returning({ id: anilistTags.id, anilistId: anilistTags.anilistId })
  const idByAnilistId = new Map(rows.map((row) => [row.anilistId, row.id]))
  await tx
    .insert(mediaTags)
    .values(
      tags.map((tag) => ({ mediaId, tagId: idByAnilistId.get(tag.anilistId)!, rank: tag.rank })),
    )
}

/**
 * Marks the media's character list as complete and drops appearances AniList no longer lists.
 * Characters themselves are kept: players may own them.
 */
async function completeCharacterSync(
  tx: Executor,
  mediaId: number,
  characterIds: number[],
): Promise<void> {
  await tx
    .delete(characterMedia)
    .where(
      characterIds.length > 0
        ? and(
            eq(characterMedia.mediaId, mediaId),
            notInArray(characterMedia.characterId, characterIds),
          )
        : eq(characterMedia.mediaId, mediaId),
    )
  await tx
    .update(media)
    .set({ charactersSyncedAt: sql`now()` })
    .where(eq(media.id, mediaId))
}
