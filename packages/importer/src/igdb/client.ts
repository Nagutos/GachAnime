import { z } from 'zod'
import { silentLogger, type ImportLogger } from '../anilist/client'

export const IGDB_ENDPOINT = 'https://api.igdb.com/v4'
export const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'

/** Credentials of the Twitch application of the instance (IGDB authenticates through Twitch). */
export interface IgdbCredentials {
  clientId: string
  clientSecret: string
}

export interface IgdbClientOptions {
  endpoint?: string
  tokenUrl?: string
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** IGDB allows 4 requests per second. */
  requestsPerSecond?: number
  /** Retries for network errors, 429 and 5xx responses. */
  maxRetries?: number
  logger?: ImportLogger
}

/** A request IGDB or Twitch refused, or that kept failing after retries. */
export class IgdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'IgdbError'
  }
}

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() })

/** Margin added to the minimum interval between two requests. */
const INTERVAL_MARGIN_MS = 30

/**
 * IGDB client (API v4, Apicalypse queries). Gets and renews an app access token from Twitch,
 * serializes requests and spaces them under the rate limit, retries 429, 5xx and network errors
 * with exponential backoff, and renews the token once on 401.
 */
export class IgdbClient {
  private readonly endpoint: string
  private readonly tokenUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number
  private readonly interval: number
  private readonly maxRetries: number
  private readonly logger: ImportLogger
  private token: { value: string; expiresAt: number } | null = null
  private nextSlotAt = 0
  private queue: Promise<unknown> = Promise.resolve()
  /** Number of HTTP requests sent to IGDB (including retries). */
  requestCount = 0

  constructor(
    private readonly credentials: IgdbCredentials,
    options: IgdbClientOptions = {},
  ) {
    this.endpoint = options.endpoint ?? IGDB_ENDPOINT
    this.tokenUrl = options.tokenUrl ?? TWITCH_TOKEN_URL
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.now = options.now ?? Date.now
    this.interval = Math.ceil(1000 / (options.requestsPerSecond ?? 4)) + INTERVAL_MARGIN_MS
    this.maxRetries = options.maxRetries ?? 5
    this.logger = options.logger ?? silentLogger
  }

  /**
   * Runs an Apicalypse query on an endpoint (`games`, `characters`…) and validates the result
   * array with `schema`. Calls are executed one at a time.
   */
  query<T>(resource: string, body: string, schema: z.ZodType<T>): Promise<T[]> {
    const run = this.queue.then(() => this.execute(resource, body, schema))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value
    const url = new URL(this.tokenUrl)
    url.searchParams.set('client_id', this.credentials.clientId)
    url.searchParams.set('client_secret', this.credentials.clientSecret)
    url.searchParams.set('grant_type', 'client_credentials')
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      throw new IgdbError(`Twitch unreachable: ${String(error)}`, 0)
    }
    const body = tokenSchema.safeParse(await response.json().catch(() => null))
    if (!response.ok || !body.success) {
      throw new IgdbError(
        `Twitch refused the IGDB credentials (HTTP ${response.status}): check IGDB_CLIENT_ID and IGDB_CLIENT_SECRET`,
        response.status,
      )
    }
    // Renewed a minute before it expires.
    this.token = {
      value: body.data.access_token,
      expiresAt: this.now() + (body.data.expires_in - 60) * 1000,
    }
    return this.token.value
  }

  private async waitForSlot(): Promise<void> {
    const wait = this.nextSlotAt - this.now()
    if (wait > 0) await this.sleep(wait)
    this.nextSlotAt = Math.max(this.now(), this.nextSlotAt) + this.interval
  }

  private async execute<T>(resource: string, body: string, schema: z.ZodType<T>): Promise<T[]> {
    let failures = 0
    let renewedToken = false
    for (;;) {
      const token = await this.accessToken()
      await this.waitForSlot()
      this.requestCount += 1

      let response: Response
      try {
        response = await this.fetchImpl(`${this.endpoint}/${resource}`, {
          method: 'POST',
          headers: {
            'client-id': this.credentials.clientId,
            authorization: `Bearer ${token}`,
            accept: 'application/json',
            'content-type': 'text/plain',
          },
          body,
          signal: AbortSignal.timeout(30_000),
        })
      } catch (error) {
        failures += 1
        if (failures > this.maxRetries) throw new IgdbError(`IGDB unreachable: ${String(error)}`, 0)
        await this.backoff(failures, { reason: String(error) })
        continue
      }

      if (response.status === 401 && !renewedToken) {
        renewedToken = true
        this.token = null
        continue
      }
      if (response.status === 429 || response.status >= 500) {
        failures += 1
        if (failures > this.maxRetries) {
          throw new IgdbError(`IGDB error HTTP ${response.status}`, response.status)
        }
        await this.backoff(failures, { status: response.status })
        continue
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new IgdbError(
          `IGDB refused the query (HTTP ${response.status}): ${text.slice(0, 300)}`,
          response.status,
        )
      }
      const json: unknown = await response.json().catch(() => null)
      if (!Array.isArray(json)) {
        throw new IgdbError(`Unexpected IGDB response (HTTP ${response.status})`, response.status)
      }
      return json.map((item) => schema.parse(item))
    }
  }

  private async backoff(attempt: number, context: object): Promise<void> {
    const waitMs = Math.min(2 ** attempt * 500, 30_000)
    this.logger.warn({ ...context, attempt, waitMs }, 'IGDB request failed, retrying')
    await this.sleep(waitMs)
  }
}
