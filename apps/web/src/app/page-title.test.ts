import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGE_TITLE_KEYS, pageTitleKey } from './page-title'
import { router } from './router'

const english = JSON.parse(
  // The happy-dom environment (needed by the router) has no file: import.meta.url.
  readFileSync(resolve(process.cwd(), 'src/locales/en.json'), 'utf8'),
) as Record<string, unknown>

function lookup(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], english)
}

describe('page titles', () => {
  it('cover every named route except home', () => {
    const names = router
      .getRoutes()
      .map((route) => route.name?.toString())
      .filter((name): name is string => Boolean(name) && name !== 'home')
    expect(names.filter((name) => !pageTitleKey(name))).toEqual([])
  })

  it.each(Object.values(PAGE_TITLE_KEYS))('%s is a translated string', (key) => {
    expect(typeof lookup(key)).toBe('string')
  })
})
