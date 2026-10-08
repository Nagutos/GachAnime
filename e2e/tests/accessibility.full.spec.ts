import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { giveCards, grantGems } from '../support/player-data'
import { signInNewPlayer } from '../support/session'

/** Automated WCAG 2.1 A/AA checks (axe-core) on every page, signed in. */

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 180_000 })

async function audit(page: Page, path: string, ready: string): Promise<string[]> {
  await page.goto(path)
  await page.locator(ready).first().waitFor({ timeout: 30_000 })
  // Let entrance animations settle: axe measures contrast on the final colors.
  await page.waitForTimeout(800)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map(
    (violation) =>
      `${path} — ${violation.id} (${violation.impact}): ${violation.help}\n    ` +
      violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join('\n    '),
  )
}

const PLAYER_PAGES: [path: string, ready: string][] = [
  ['/', 'h1'],
  ['/boosters', 'main h1'],
  ['/collection', 'main h1'],
  ['/collection/series', 'main h1'],
  ['/wiki', 'main h1'],
  ['/missions', 'main h1'],
  ['/achievements', 'main h1'],
  ['/gems', 'main h1'],
  ['/market', 'main h1'],
  ['/trades', 'main h1'],
  ['/players', 'main h1'],
]

const ADMIN_PAGES: [path: string, ready: string][] = [
  ['/admin', 'main h1'],
  ['/admin/series', 'main h1'],
  ['/admin/characters', 'main h1'],
  ['/admin/imports', 'main h1'],
  ['/admin/boosters', 'main h1'],
  ['/admin/rarities', 'main h1'],
  ['/admin/settings', 'main h1'],
  ['/admin/themes', 'main h1'],
  ['/admin/missions', 'main h1'],
  ['/admin/achievements', 'main h1'],
  ['/admin/users', 'main h1'],
  ['/admin/audit', 'main h1'],
]

test('player pages have no WCAG A/AA violations', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const player = await signInNewPlayer(context, 'Axe Player')
  const [card] = await giveCards(player.userId, 3, 2, 0)
  await grantGems(player.userId, 1000)
  const page = await context.newPage()
  const violations: string[] = []
  for (const [path, ready] of [
    ...PLAYER_PAGES,
    [`/wiki/characters/${card}`, '[data-testid="wiki-name"]'],
    [`/u/${player.username}`, 'main h1'],
  ] as const) {
    violations.push(...(await audit(page, path, ready)))
  }
  expect(violations, violations.join('\n')).toEqual([])
  await context.close()
})

test('admin pages have no WCAG A/AA violations', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  await signInNewPlayer(context, 'Axe Admin', undefined, 'admin')
  const page = await context.newPage()
  const violations: string[] = []
  for (const [path, ready] of ADMIN_PAGES) violations.push(...(await audit(page, path, ready)))
  expect(violations, violations.join('\n')).toEqual([])
  await context.close()
})
