// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ERROR_CODES } from '@gachanime/shared'
import { describe, expect, it } from 'vitest'
import { compareLocaleKeys, flattenKeys } from './keys'

// Read the raw JSON files: through Vite they are precompiled into message ASTs.
const directory = fileURLToPath(new URL('.', import.meta.url))
const raw: Record<string, unknown> = Object.fromEntries(
  readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file.slice(0, -5), JSON.parse(readFileSync(`${directory}${file}`, 'utf8'))]),
)
const REFERENCE = 'en'

describe('compareLocaleKeys', () => {
  it('reports missing and extra keys', () => {
    expect(compareLocaleKeys({ a: { b: 'x', c: 'y' } }, { a: { b: 'x' }, d: 'z' })).toEqual({
      missing: ['a.c'],
      extra: ['d'],
    })
  })
})

describe('locale files', () => {
  it('include English and French', () => {
    expect(Object.keys(raw)).toEqual(expect.arrayContaining(['en', 'fr']))
  })

  it.each(Object.keys(raw).filter((locale) => locale !== REFERENCE))(
    '%s has exactly the same keys as English',
    (locale) => {
      expect(compareLocaleKeys(raw[REFERENCE], raw[locale])).toEqual({ missing: [], extra: [] })
    },
  )

  it('translate every API error code', () => {
    const keys = flattenKeys(raw[REFERENCE])
    for (const code of ERROR_CODES) expect(keys).toContain(`errors.${code}`)
  })
})
