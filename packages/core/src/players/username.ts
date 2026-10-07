const MIN_LENGTH = 3
const MAX_BASE_LENGTH = 24

/** Turns a display name into a valid username base (`^[a-z0-9_]{3,32}$`). */
export function toUsernameBase(displayName: string): string {
  const base = displayName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, MAX_BASE_LENGTH)
  return base.length >= MIN_LENGTH ? base : 'player'
}

/** Candidate usernames in order of preference: `base`, `base_2`, `base_3`… */
export function usernameCandidate(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}_${attempt}`
}
