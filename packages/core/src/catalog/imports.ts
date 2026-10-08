import { importJobs, type Database, type Executor } from '@gachanime/db'
import {
  importParamsSchema,
  importProgressSchema,
  type ImportJobDto,
  type ImportParams,
} from '@gachanime/shared'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { recordAdminAction } from '../admin/audit'
import { AppError } from '../errors'

type ImportJobRow = typeof importJobs.$inferSelect

export function toImportJobDto(row: ImportJobRow): ImportJobDto {
  const progress = importProgressSchema
    .omit({ mediaAnilistIds: true, gameIgdbIds: true })
    .parse(row.progress)
  return {
    id: row.id,
    params: importParamsSchema.parse(row.params),
    status: row.status,
    progress,
    error: row.error,
    requestedBy: row.requestedBy,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  }
}

/** Jobs a worker should (re)start: queued, or running when the worker stopped. */
export async function listUnfinishedImportJobs(db: Executor): Promise<number[]> {
  const rows = await db
    .select({ id: importJobs.id })
    .from(importJobs)
    .where(inArray(importJobs.status, ['queued', 'running']))
    .orderBy(importJobs.id)
  return rows.map((row) => row.id)
}

/**
 * Creates a queued import job. Only one import runs at a time: AniList's rate limit is shared and
 * two imports would compete for the same media rows.
 */
export async function createImportJob(
  database: Database,
  input: { params: ImportParams; actorId: string | null; ip?: string | null },
): Promise<ImportJobDto> {
  return database.transaction(async (db) => {
    await lockImportJobs(db)
    const [row] = await db
      .insert(importJobs)
      .values({ params: input.params, requestedBy: input.actorId, progress: {} })
      .returning()
    if (input.actorId !== null) {
      await recordAdminAction(db, {
        actorId: input.actorId,
        action: 'import.create',
        targetType: 'import_job',
        targetId: String(row!.id),
        after: input.params,
        ip: input.ip ?? null,
      })
    }
    return toImportJobDto(row!)
  })
}

export async function listImportJobs(db: Executor, limit = 20): Promise<ImportJobDto[]> {
  const rows = await db.select().from(importJobs).orderBy(desc(importJobs.id)).limit(limit)
  return rows.map(toImportJobDto)
}

export async function getImportJob(db: Executor, id: number): Promise<ImportJobDto> {
  const [row] = await db.select().from(importJobs).where(eq(importJobs.id, id))
  if (!row) throw new AppError('NOT_FOUND', `Import #${id} not found`)
  return toImportJobDto(row)
}

/** Asks a queued or running job to stop; the importer checks the status between steps. */
export async function cancelImportJob(
  database: Database,
  input: { id: number; actorId: string; ip?: string | null },
): Promise<ImportJobDto> {
  return database.transaction(async (db) => {
    const [row] = await db
      .update(importJobs)
      .set({ status: 'cancelled', finishedAt: new Date() })
      .where(sql`${importJobs.id} = ${input.id} AND ${importJobs.status} IN ('queued', 'running')`)
      .returning()
    if (!row) throw new AppError('CONFLICT', `Import #${input.id} is not running`)
    await recordAdminAction(db, {
      actorId: input.actorId,
      action: 'import.cancel',
      targetType: 'import_job',
      targetId: String(input.id),
      ip: input.ip ?? null,
    })
    return toImportJobDto(row)
  })
}

/** Queues a failed or cancelled job again; it resumes from its saved progress. */
export async function resumeImportJob(
  database: Database,
  input: { id: number; actorId: string; ip?: string | null },
): Promise<ImportJobDto> {
  return database.transaction(async (db) => {
    await lockImportJobs(db)
    const [row] = await db
      .update(importJobs)
      .set({ status: 'queued', error: null, finishedAt: null })
      .where(
        sql`${importJobs.id} = ${input.id} AND ${importJobs.status} IN ('failed', 'cancelled')`,
      )
      .returning()
    if (!row) throw new AppError('CONFLICT', `Import #${input.id} cannot be resumed`)
    await recordAdminAction(db, {
      actorId: input.actorId,
      action: 'import.resume',
      targetType: 'import_job',
      targetId: String(input.id),
      ip: input.ip ?? null,
    })
    return toImportJobDto(row)
  })
}

/**
 * Serializes job creation/resumption until the end of the transaction and refuses it while
 * another import is unfinished.
 */
async function lockImportJobs(db: Executor): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('gachanime:import_jobs'))`)
  const unfinished = await listUnfinishedImportJobs(db)
  if (unfinished.length > 0) {
    throw new AppError('IMPORT_IN_PROGRESS', `Import #${unfinished[0]} is not finished yet`)
  }
}
