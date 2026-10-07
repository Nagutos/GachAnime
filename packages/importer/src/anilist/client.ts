import { z } from 'zod'

export const ANILIST_ENDPOINT = 'https://graphql.anilist.co'

/** Minimal logger interface (pino-compatible). */
export interface ImportLogger {
  info(object: object, message: string): void
  warn(object: object, message: string): void
}

export const silentLogger: ImportLogger = { info: () => {}, warn: () => {} }

export interface AniListClientOptions {
  endpoint?: string
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** Used until AniList reports its own limit in `X-RateLimit-Limit`. */
  requestsPerMinute?: number
  /** Retries for network errors and 5xx responses (429 has its own budget). */
  maxRetries?: number
  logger?: ImportLogger
}

/** A request AniList refused (bad query, unknown id…) or that kept failing after retries. */
export class AniListError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AniListError'
  }
}

const graphQlResponseSchema = z.object({
  data: z.unknown().nullable().optional(),
  errors: z.array(z.object({ message: z.string(), status: z.number().optional() })).optional(),
})

const MAX_RATE_LIMIT_RETRIES = 20
/** Margin added to the minimum interval between two requests. */
const INTERVAL_MARGIN_MS = 150

/**
 * AniList GraphQL client. Requests are serialized and spaced to stay under the rate limit
 * (currently 30/min, normally 90/min: the limit is read from the response headers), 429 responses
 * wait for `Retry-After`, network errors and 5xx are retried with exponential backoff.
 */
export class AniListClient {
  private readonly endpoint: string
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number
  private readonly maxRetries: number
  private readonly logger: ImportLogger
  private requestsPerMinute: number
  private nextSlotAt = 0
  private queue: Promise<unknown> = Promise.resolve()
  /** Number of HTTP requests sent (including retries). */
  requestCount = 0

  constructor(options: AniListClientOptions = {}) {
    this.endpoint = options.endpoint ?? ANILIST_ENDPOINT
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.now = options.now ?? Date.now
    this.requestsPerMinute = options.requestsPerMinute ?? 30
    this.maxRetries = options.maxRetries ?? 5
    this.logger = options.logger ?? silentLogger
  }

  /** Runs a query and validates `data` with `schema`. Calls are executed one at a time. */
  query<T>(query: string, variables: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const run = this.queue.then(() => this.execute(query, variables, schema))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async waitForSlot(): Promise<void> {
    const wait = this.nextSlotAt - this.now()
    if (wait > 0) await this.sleep(wait)
    const interval = Math.ceil(60_000 / this.requestsPerMinute) + INTERVAL_MARGIN_MS
    this.nextSlotAt = Math.max(this.now(), this.nextSlotAt) + interval
  }

  private async execute<T>(
    query: string,
    variables: Record<string, unknown>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    let failures = 0
    let rateLimited = 0
    for (;;) {
      await this.waitForSlot()
      this.requestCount += 1

      let response: Response
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(30_000),
        })
      } catch (error) {
        failures += 1
        if (failures > this.maxRetries) {
          throw new AniListError(`AniList unreachable: ${String(error)}`, 0)
        }
        await this.backoff(failures, { reason: String(error) })
        continue
      }

      this.readRateLimitHeaders(response.headers)

      if (response.status === 429) {
        rateLimited += 1
        if (rateLimited > MAX_RATE_LIMIT_RETRIES) {
          throw new AniListError('AniList kept rate limiting the importer', 429)
        }
        const retryAfter = Number(response.headers.get('retry-after'))
        const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60) * 1000
        this.logger.warn({ waitMs }, 'AniList rate limit reached, waiting')
        await this.sleep(waitMs + 1000)
        this.nextSlotAt = this.now()
        continue
      }

      if (response.status >= 500) {
        failures += 1
        if (failures > this.maxRetries) {
          throw new AniListError(`AniList error HTTP ${response.status}`, response.status)
        }
        await this.backoff(failures, { status: response.status })
        continue
      }

      const body = graphQlResponseSchema.safeParse(await response.json().catch(() => null))
      if (!body.success) {
        throw new AniListError(
          `Unexpected AniList response (HTTP ${response.status})`,
          response.status,
        )
      }
      if (!response.ok || body.data.errors?.length) {
        const message = body.data.errors?.map((error) => error.message).join('; ')
        throw new AniListError(message || `AniList error HTTP ${response.status}`, response.status)
      }
      return schema.parse(body.data.data)
    }
  }

  private readRateLimitHeaders(headers: Headers): void {
    const limit = Number(headers.get('x-ratelimit-limit'))
    if (Number.isInteger(limit) && limit > 0 && limit !== this.requestsPerMinute) {
      this.logger.info({ requestsPerMinute: limit }, 'AniList rate limit updated')
      this.requestsPerMinute = limit
    }
    // Out of budget: wait for the reset announced by AniList.
    const remaining = Number(headers.get('x-ratelimit-remaining'))
    const reset = Number(headers.get('x-ratelimit-reset'))
    if (headers.has('x-ratelimit-remaining') && remaining <= 0 && reset > 0) {
      this.nextSlotAt = Math.max(this.nextSlotAt, reset * 1000 + 500)
    }
  }

  private async backoff(attempt: number, context: object): Promise<void> {
    const waitMs = Math.min(2 ** attempt * 1000, 60_000)
    this.logger.warn({ ...context, attempt, waitMs }, 'AniList request failed, retrying')
    await this.sleep(waitMs)
  }
}
