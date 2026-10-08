import {
  RarityTable,
  rebuildSeriesCharacters,
  recomputeDefaultRarities,
  refreshIgdbSeries,
  uniqueSeriesSlug,
} from '@gachanime/core'
import {
  characterGames,
  characters,
  igdbGames,
  importJobs,
  series,
  type Database,
  type Executor,
} from '@gachanime/db'
import { importProgressSchema, type ImportParams, type ImportProgress } from '@gachanime/shared'
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { ImportLogger } from '../anilist/client'
import { ImportCancelled } from '../job'
import {
  fetchGameCharactersPage,
  fetchGames,
  fetchTopGameIds,
  IGDB_GAMES_PER_CHARACTER_QUERY,
  IGDB_PAGE_SIZE,
  type IgdbGame,
} from './api'
import type { IgdbClient } from './client'
import { isImportableGame, seriesOfGame, toCharacterRow, toGameRow } from './mapping'

/** Safety net against a game with an endless character list. */
const MAX_CHARACTER_PAGES = 40

/** `excluded.<column>` in an `ON CONFLICT DO UPDATE` clause. */
const excluded = (column: string) => sql.raw(`excluded.${column}`)

type IgdbParams = Extract<ImportParams, { mode: 'igdb_top' | 'igdb_ids' }>

/**
 * IGDB import (video games, ADR-025), resumable like the AniList one:
 * 1. discover — the games (top N most rated main games, or ids) and their series: the first
 *    IGDB collection of a game, else the game alone; existing assignments are kept;
 * 2. characters — characters with a portrait of every game not synced during this job;
 * 3. finalize — series membership and metadata, game popularity of the characters and their
 *    default rarities (ADR-026).
 */
export class IgdbImportRun {
  progress: ImportProgress = importProgressSchema.parse({})
  private readonly requestsAtStart: number
  private baseRequests = 0

  constructor(
    private readonly db: Database,
    private readonly client: IgdbClient,
    private readonly logger: ImportLogger,
    private readonly jobId: number,
    private readonly params: IgdbParams,
    /** Games synced at or after this instant are fresh for this job. */
    private readonly freshSince: Date,
  ) {
    this.requestsAtStart = client.requestCount
  }

  summary() {
    return importProgressSchema
      .omit({ mediaAnilistIds: true, gameIgdbIds: true })
      .parse(this.progress)
  }

  async execute(): Promise<void> {
    this.baseRequests = this.progress.requests
    if (this.progress.phase === 'discover' || this.progress.phase === 'group') {
      await this.discover()
      this.progress.phase = 'characters'
      await this.saveProgress()
    }
    if (this.progress.phase === 'characters') {
      await this.syncCharacters()
      this.progress.phase = 'finalize'
      await this.saveProgress()
    }
    if (this.progress.phase === 'finalize') {
      await this.finalize()
      this.progress.phase = 'done'
    }
  }

  private countRequests(): void {
    this.progress.requests = this.baseRequests + this.client.requestCount - this.requestsAtStart
  }

  // ─── 1. Discovery ──────────────────────────────────────────────────────────

  private async discover(): Promise<void> {
    const seeds =
      this.params.mode === 'igdb_top'
        ? await fetchTopGameIds(this.client, this.params.top)
        : [...new Set(this.params.igdbIds)]
    this.progress.seedCount = seeds.length
    this.countRequests()
    this.logger.info({ jobId: this.jobId, games: seeds.length }, 'IGDB discovery started')

    const imported: number[] = []
    for (let start = 0; start < seeds.length; start += IGDB_PAGE_SIZE) {
      await this.assertNotCancelled()
      const games = await fetchGames(this.client, seeds.slice(start, start + IGDB_PAGE_SIZE))
      this.countRequests()
      for (const game of games.filter(isImportableGame)) {
        await this.db.transaction((tx) => this.storeGame(tx, game))
        imported.push(game.id)
      }
      this.progress.mediaTotal = imported.length
      await this.saveProgress()
    }
    this.progress.gameIgdbIds = imported
  }

  private async storeGame(tx: Executor, game: IgdbGame): Promise<void> {
    const [existing] = await tx
      .select({ seriesId: igdbGames.seriesId })
      .from(igdbGames)
      .where(eq(igdbGames.igdbId, game.id))
    const seriesId = existing?.seriesId ?? (await this.seriesFor(tx, game))
    await tx
      .insert(igdbGames)
      .values({ ...toGameRow(game), seriesId })
      .onConflictDoUpdate({
        target: igdbGames.igdbId,
        set: {
          name: excluded('name'),
          summary: excluded('summary'),
          coverUrl: excluded('cover_url'),
          ratingCount: excluded('rating_count'),
          genres: excluded('genres'),
          themes: excluded('themes'),
          releaseYear: excluded('release_year'),
          siteUrl: excluded('site_url'),
          updatedAt: sql`now()`,
        },
      })
  }

  /** The series of the game's collection (created on first sight), or a series of its own. */
  private async seriesFor(tx: Executor, game: IgdbGame): Promise<number> {
    const { igdbKey, title } = seriesOfGame(game)
    const [found] = await tx
      .select({ id: series.id })
      .from(series)
      .where(eq(series.igdbKey, igdbKey))
    if (found) return found.id
    const [created] = await tx
      .insert(series)
      .values({
        slug: await uniqueSeriesSlug(tx, title, igdbKey.replace(':', '-')),
        kind: 'game',
        source: 'igdb',
        title,
        igdbKey,
      })
      .returning({ id: series.id })
    this.progress.seriesCreated += 1
    return created!.id
  }

  // ─── 2. Characters ─────────────────────────────────────────────────────────

  private async syncCharacters(): Promise<void> {
    const ids = this.progress.gameIgdbIds
    if (ids.length === 0) return
    const pending = await this.db
      .select({ id: igdbGames.id, igdbId: igdbGames.igdbId })
      .from(igdbGames)
      .where(
        and(
          inArray(igdbGames.igdbId, ids),
          or(
            isNull(igdbGames.charactersSyncedAt),
            lt(igdbGames.charactersSyncedAt, this.freshSince),
          ),
        ),
      )
    this.progress.mediaCharactersDone = ids.length - pending.length

    for (let start = 0; start < pending.length; start += IGDB_GAMES_PER_CHARACTER_QUERY) {
      await this.assertNotCancelled()
      const batch = pending.slice(start, start + IGDB_GAMES_PER_CHARACTER_QUERY)
      for (let page = 0; page < MAX_CHARACTER_PAGES; page++) {
        const characterPage = await fetchGameCharactersPage(
          this.client,
          batch.map((game) => game.igdbId),
          page * IGDB_PAGE_SIZE,
        )
        this.countRequests()
        await this.db.transaction((tx) => this.storeCharacters(tx, characterPage))
        if (characterPage.length < IGDB_PAGE_SIZE) break
      }
      await this.db
        .update(igdbGames)
        .set({ charactersSyncedAt: sql`now()` })
        .where(
          inArray(
            igdbGames.id,
            batch.map((game) => game.id),
          ),
        )
      this.progress.mediaCharactersDone += batch.length
      await this.saveProgress()
    }
  }

  private async storeCharacters(
    tx: Executor,
    page: Awaited<ReturnType<typeof fetchGameCharactersPage>>,
  ): Promise<void> {
    const rows = page.flatMap((character) => {
      const row = toCharacterRow(character)
      if (!row) this.progress.charactersSkippedNoImage += 1
      return row ? [{ row, games: character.games ?? [] }] : []
    })
    if (rows.length === 0) return

    // Rarity is set in `finalize`, once every game of the character is known.
    const lowest = (await RarityTable.load(tx)).lowest.id
    const stored = await tx
      .insert(characters)
      .values(rows.map(({ row }) => ({ ...row, source: 'igdb' as const, rarityId: lowest })))
      .onConflictDoUpdate({
        target: characters.igdbId,
        set: {
          nameFull: excluded('name_full'),
          nameAlternatives: excluded('name_alternatives'),
          description: excluded('description'),
          imageUrl: excluded('image_url'),
          siteUrl: excluded('site_url'),
          genderRaw: excluded('gender_raw'),
          genderClass: excluded('gender_class'),
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: characters.id, igdbId: characters.igdbId })
    const characterIdByIgdbId = new Map(stored.map((item) => [item.igdbId!, item.id]))

    // Links to every imported game of the character (not only the games of this query).
    const gameIgdbIds = [...new Set(rows.flatMap(({ games }) => games))]
    const known = await tx
      .select({ id: igdbGames.id, igdbId: igdbGames.igdbId })
      .from(igdbGames)
      .where(inArray(igdbGames.igdbId, gameIgdbIds))
    const gameIdByIgdbId = new Map(known.map((game) => [game.igdbId, game.id]))
    const links = rows.flatMap(({ row, games }) =>
      games.flatMap((igdbId) => {
        const gameId = gameIdByIgdbId.get(igdbId)
        const characterId = characterIdByIgdbId.get(row.igdbId)
        return gameId && characterId ? [{ characterId, gameId }] : []
      }),
    )
    if (links.length > 0) await tx.insert(characterGames).values(links).onConflictDoNothing()
    this.progress.charactersUpserted += stored.length
  }

  // ─── 3. Finalize ───────────────────────────────────────────────────────────

  private async finalize(): Promise<void> {
    const ids = this.progress.gameIgdbIds
    if (ids.length === 0) return
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .selectDistinct({ seriesId: igdbGames.seriesId })
        .from(igdbGames)
        .where(inArray(igdbGames.igdbId, ids))
      const seriesIds = rows.map((row) => row.seriesId)
      await rebuildSeriesCharacters(tx, seriesIds)
      await refreshIgdbSeries(tx, seriesIds)
      // Popularity of a character = rating count of its most popular game (ADR-026).
      await tx.execute(sql`
        UPDATE characters c SET game_popularity = p.popularity
        FROM (
          SELECT cg.character_id, max(g.rating_count) AS popularity
          FROM character_games cg JOIN igdb_games g ON g.id = cg.game_id
          WHERE cg.character_id IN (
            SELECT cg2.character_id FROM character_games cg2
            JOIN igdb_games g2 ON g2.id = cg2.game_id
            WHERE g2.igdb_id IN ${ids})
          GROUP BY cg.character_id
        ) p
        WHERE c.id = p.character_id AND c.game_popularity IS DISTINCT FROM p.popularity`)
      await recomputeDefaultRarities(tx)
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
