/**
 * Daily periods (missions, market limits): a period starts every day at `hour` local time in
 * `timeZone` (GAME_DESIGN §8). Its key is the local date it starts on, `YYYY-MM-DD`. No cron: a
 * new day simply gives a new key. Computed with Intl so DST changes are handled.
 */
export interface DailyReset {
  hour: number
  timeZone: string
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function localParts(instant: Date, timeZone: string): LocalParts {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, formatter)
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, Number(part.value)]),
  )
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  }
}

/** Offset (ms) of `timeZone` from UTC at `instant`. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = localParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** Instant of a local wall-clock time; a time skipped by DST resolves to the first valid one. */
function zonedInstant(year: number, month: number, day: number, hour: number, timeZone: string) {
  const wallUtc = Date.UTC(year, month - 1, day, hour)
  let guess = wallUtc - offsetMs(new Date(wallUtc), timeZone)
  guess = wallUtc - offsetMs(new Date(guess), timeZone)
  return new Date(guess)
}

function addDays(year: number, month: number, day: number, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

const pad = (value: number) => String(value).padStart(2, '0')

export function periodKey(now: Date, reset: DailyReset): string {
  const local = localParts(now, reset.timeZone)
  const start =
    local.hour < reset.hour
      ? addDays(local.year, local.month, local.day, -1)
      : { year: local.year, month: local.month, day: local.day }
  return `${start.year}-${pad(start.month)}-${pad(start.day)}`
}

/** When the period containing `now` started (daily market limits count from there). */
export function periodStartAt(now: Date, reset: DailyReset): Date {
  const [year, month, day] = periodKey(now, reset).split('-').map(Number) as [
    number,
    number,
    number,
  ]
  return zonedInstant(year, month, day, reset.hour, reset.timeZone)
}

/** When the period containing `now` ends (the next reset). */
export function nextResetAt(now: Date, reset: DailyReset): Date {
  const [year, month, day] = periodKey(now, reset).split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const next = addDays(year, month, day, 1)
  return zonedInstant(next.year, next.month, next.day, reset.hour, reset.timeZone)
}

/** Key of missions done once per account (welcome mission…). */
export const ONCE_PERIOD_KEY = 'once'
