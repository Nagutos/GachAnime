import { z } from 'zod'

/** Reference and fallback locale for the UI and for DB-managed content. */
export const DEFAULT_LOCALE = 'en'

/**
 * A locale code such as `en`, `fr` or `pt-BR`. The list of locales offered in the UI is derived
 * from the translation files present in the web app, so the server only checks the shape.
 */
export const localeCodeSchema = z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Invalid locale code')

export type LocaleCode = z.infer<typeof localeCodeSchema>
