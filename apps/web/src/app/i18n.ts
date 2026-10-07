import { useStorage } from '@vueuse/core'
import { createI18n } from 'vue-i18n'
import { availableLocales, FALLBACK_LOCALE, messages } from '@/locales'
import { pickLocale } from './locale'

const numberFormat = {
  integer: { maximumFractionDigits: 0 },
  decimal: { maximumFractionDigits: 2 },
  percent: { style: 'percent', maximumFractionDigits: 2 },
  /** Drop rates: small values such as 0.066 %. */
  rate: { style: 'percent', maximumFractionDigits: 3 },
} as const

const datetimeFormat = {
  short: { dateStyle: 'short' },
  long: { dateStyle: 'long', timeStyle: 'short' },
} as const

/** Locale chosen on this device; the profile locale overrides it once signed in. */
export const storedLocale = useStorage<string | null>('gachanime.locale', null)

function initialLocale(): string {
  if (storedLocale.value && availableLocales.includes(storedLocale.value)) {
    return storedLocale.value
  }
  return pickLocale(navigator.languages, availableLocales, FALLBACK_LOCALE)
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: FALLBACK_LOCALE,
  messages,
  numberFormats: Object.fromEntries(availableLocales.map((locale) => [locale, numberFormat])),
  datetimeFormats: Object.fromEntries(availableLocales.map((locale) => [locale, datetimeFormat])),
})

export function applyLocale(locale: string): void {
  if (!availableLocales.includes(locale)) return
  i18n.global.locale.value = locale
  storedLocale.value = locale
  document.documentElement.lang = locale
}

applyLocale(i18n.global.locale.value)
