/**
 * AniList descriptions contain light HTML (`<br>`, `<i>`…) even in markdown mode. The admin shows
 * them as plain text; Vue escapes the result.
 */
export function plainText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Drops empty translations before saving localized DB content (`{ en, fr? }`). */
export function cleanLocalized<T extends Record<string, string | undefined>>(text: T): T {
  return Object.fromEntries(
    Object.entries(text).filter(([, value]) => typeof value === 'string' && value.trim() !== ''),
  ) as T
}
