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
