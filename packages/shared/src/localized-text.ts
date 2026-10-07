import { z } from 'zod'
import { DEFAULT_LOCALE, localeCodeSchema } from './locale'

/** Translatable text stored in the database: one entry per locale, English required. */
export const localizedTextSchema = z
  .record(localeCodeSchema, z.string().trim().min(1))
  .refine((value) => typeof value[DEFAULT_LOCALE] === 'string', {
    message: `A "${DEFAULT_LOCALE}" translation is required`,
  })

export type LocalizedText = z.infer<typeof localizedTextSchema>

/** Returns the text for `locale`, then its base language (`pt` for `pt-BR`), then English. */
export function resolveLocalizedText(text: LocalizedText, locale: string): string {
  const baseLanguage = locale.split('-')[0] ?? locale
  return text[locale] ?? text[baseLanguage] ?? text[DEFAULT_LOCALE] ?? ''
}
