import type { LocaleMessageValue, VueMessageType } from 'vue-i18n'

type LocaleMessage = Record<string, LocaleMessageValue<VueMessageType>>

/**
 * Every `*.json` file in this folder is a locale. Adding a language = adding a file.
 * `en` is the reference and fallback locale.
 */
const files = import.meta.glob<{ default: LocaleMessage }>('./*.json', { eager: true })

export const messages: Record<string, LocaleMessage> = Object.fromEntries(
  Object.entries(files).map(([path, module]) => [path.slice(2, -5), module.default]),
)

export const FALLBACK_LOCALE = 'en'
export const availableLocales: string[] = Object.keys(messages).sort()
