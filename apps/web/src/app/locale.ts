/**
 * Picks the best available locale for a list of preferred ones (e.g. `navigator.languages`):
 * exact match first, then same base language (`fr-CA` → `fr`), then the fallback.
 */
export function pickLocale(
  preferred: readonly string[],
  available: readonly string[],
  fallback: string,
): string {
  for (const candidate of preferred) {
    if (available.includes(candidate)) return candidate
    const base = candidate.split('-')[0]?.toLowerCase()
    const match = available.find((locale) => locale.split('-')[0] === base)
    if (match) return match
  }
  return fallback
}
