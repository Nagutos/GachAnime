import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compareLocaleKeys } from '../src/locales/keys'

const localesDir = fileURLToPath(new URL('../src/locales/', import.meta.url))
const REFERENCE = 'en'

const load = (code: string): unknown =>
  JSON.parse(readFileSync(`${localesDir}${code}.json`, 'utf8'))
const locales = readdirSync(localesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -5))

let failed = false
for (const code of locales.filter((locale) => locale !== REFERENCE)) {
  const { missing, extra } = compareLocaleKeys(load(REFERENCE), load(code))
  for (const key of missing) console.error(`[${code}] missing key: ${key}`)
  for (const key of extra) console.error(`[${code}] key not in ${REFERENCE}: ${key}`)
  failed ||= missing.length > 0 || extra.length > 0
}

if (failed) process.exit(1)
console.log(`i18n OK: ${locales.join(', ')} have the same keys as ${REFERENCE}.`)
