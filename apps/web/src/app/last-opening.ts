import type { OpenBoostersResponse } from '@gachanime/shared'

/** What the opening scene needs to show an opening again. */
export interface StoredOpening {
  result: OpenBoostersResponse
  label: string
  art: string
  color: string | null
  seal: string
}

/**
 * The last opening of this tab, so that "back" from a card of the summary (wiki page) shows the
 * summary again. Session storage: per tab, survives a reload; display only (the server already
 * applied the opening).
 */
const KEY = 'gachanime:last-opening'

export function saveLastOpening(opening: StoredOpening): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(opening))
  } catch {
    // Storage unavailable (private mode, quota): back simply shows the shop.
  }
}

/** The stored opening when it is the one with this id. */
export function loadLastOpening(openingId: number): StoredOpening | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const stored = raw ? (JSON.parse(raw) as StoredOpening) : null
    return stored?.result.openingId === openingId ? stored : null
  } catch {
    return null
  }
}

export function clearLastOpening(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
