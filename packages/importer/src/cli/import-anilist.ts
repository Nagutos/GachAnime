import { parseArgs } from 'node:util'
import { cliArgs, createImportJob, getImportJob } from '@gachanime/core'
import { createDatabase, importJobs } from '@gachanime/db'
import { IMPORT_TOP_DEFAULT, importParamsSchema } from '@gachanime/shared'
import { eq } from 'drizzle-orm'
import { AniListClient, type ImportLogger } from '../anilist/client'
import { runImportJob } from '../pipeline'

const usage = `Usage:
  pnpm import:anilist -- [--top 500]          import the N most popular anime and their franchises
      [--genre Romance] [--tag Shoujo]        only anime with one of these genres / tags (repeatable)
  pnpm import:anilist -- --ids 16498,1535     import given AniList anime ids (and their franchises)
  pnpm import:anilist -- --resume <jobId>     resume a failed, cancelled or interrupted import
Options: --no-franchise (do not follow relations)`

const { values } = parseArgs({
  args: cliArgs(),
  options: {
    top: { type: 'string' },
    genre: { type: 'string', multiple: true },
    tag: { type: 'string', multiple: true },
    ids: { type: 'string' },
    resume: { type: 'string' },
    'no-franchise': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})

const databaseUrl = process.env.DATABASE_URL
if (values.help || !databaseUrl) {
  console.error(databaseUrl ? usage : `DATABASE_URL must be set.\n${usage}`)
  process.exit(values.help ? 0 : 1)
}

const logger: ImportLogger = {
  info: (object, message) => console.log(message, JSON.stringify(object)),
  warn: (object, message) => console.warn(message, JSON.stringify(object)),
}

const { db, pool } = createDatabase(databaseUrl, { max: 2 })
try {
  let jobId: number
  if (values.resume) {
    jobId = Number(values.resume)
    const job = await getImportJob(db, jobId)
    if (job.status === 'failed' || job.status === 'cancelled') {
      // CLI actions have no admin user: reset the status directly.
      await db
        .update(importJobs)
        .set({ status: 'queued', error: null })
        .where(eq(importJobs.id, jobId))
    } else if (job.status === 'completed') {
      throw new Error(`Import #${jobId} is already completed`)
    }
  } else {
    const params = importParamsSchema.parse(
      values.ids
        ? {
            mode: 'ids',
            anilistIds: values.ids.split(',').map((id) => Number(id.trim())),
            expandFranchise: !values['no-franchise'],
          }
        : {
            mode: 'top',
            top: values.top ? Number(values.top) : IMPORT_TOP_DEFAULT,
            expandFranchise: !values['no-franchise'],
            genres: values.genre ?? [],
            tags: values.tag ?? [],
          },
    )
    jobId = (await createImportJob(db, { params, actorId: null })).id
  }

  console.log(`Import #${jobId} started (Ctrl+C to stop, --resume ${jobId} to continue).`)
  const client = new AniListClient({ logger })
  const timer = setInterval(async () => {
    const job = await getImportJob(db, jobId).catch(() => null)
    if (job) console.log(`[#${jobId}] ${JSON.stringify(job.progress)}`)
  }, 30_000)
  try {
    const outcome = await runImportJob({ db, client, logger }, jobId)
    const job = await getImportJob(db, jobId)
    console.log(`Import #${jobId} ${outcome}.`, JSON.stringify(job.progress))
  } finally {
    clearInterval(timer)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await pool.end()
}
