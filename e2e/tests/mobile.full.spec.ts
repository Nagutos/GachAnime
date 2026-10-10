import { expect, test, type Page } from '@playwright/test'
import { giveCards, grantGems } from '../support/player-data'
import { signInNewPlayer } from '../support/session'

/** Phone-sized layout: no page may scroll horizontally (content cut off or zoomed out). */

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 180_000 })

const PHONE = { width: 375, height: 740 }

async function horizontalOverflow(page: Page, path: string, ready: string): Promise<string[]> {
  await page.goto(path)
  await page.locator(ready).first().waitFor({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  if (process.env.E2E_SCREENSHOTS) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOTS}/${path.replaceAll('/', '_') || 'home'}.png`,
      fullPage: true,
    })
  }
  // Elements sticking out of the viewport, ignoring those inside their own scroll container.
  return page.evaluate((width) => {
    const offenders: string[] = []
    if (document.documentElement.scrollWidth <= width) return offenders
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      const rect = element.getBoundingClientRect()
      if (rect.right <= width + 1) continue
      let parent = element.parentElement
      let clipped = false
      while (parent) {
        const overflow = getComputedStyle(parent).overflowX
        if (overflow !== 'visible') {
          clipped = true
          break
        }
        parent = parent.parentElement
      }
      if (!clipped) offenders.push(`${element.tagName.toLowerCase()}.${element.className}`)
    }
    return offenders.slice(0, 5)
  }, PHONE.width)
}

test('player pages fit a phone screen', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US', viewport: PHONE, hasTouch: true })
  const player = await signInNewPlayer(context, 'Phone Player')
  const [card] = await giveCards(player.userId, 6, 2, 0)
  await grantGems(player.userId, 1000)
  const page = await context.newPage()
  const pages: [string, string][] = [
    ['/', 'h1'],
    ['/boosters', 'main h1'],
    ['/collection', 'main h1'],
    ['/collection/series', 'main h1'],
    ['/wiki', 'main h1'],
    [`/wiki/characters/${card}`, '[data-testid="wiki-name"]'],
    ['/missions', 'main h1'],
    ['/achievements', 'main h1'],
    ['/gems', 'main h1'],
    ['/upgrades', '[data-testid="upgrade-booster_storage"]'],
    ['/market', 'main h1'],
    ['/trades', 'main h1'],
    ['/players', 'main h1'],
    [`/u/${player.username}`, 'main h1'],
  ]
  const problems: string[] = []
  for (const [path, ready] of pages) {
    const offenders = await horizontalOverflow(page, path, ready)
    if (offenders.length) problems.push(`${path}: ${offenders.join(', ')}`)
  }
  expect(problems, problems.join('\n')).toEqual([])
  await context.close()
})

test('a ×10 opening stays light on a phone', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US', viewport: PHONE, hasTouch: true })
  await signInNewPlayer(context, 'Phone Opener')
  const page = await context.newPage()
  await page.goto('/boosters')
  await page.getByTestId('open-10').click({ timeout: 30_000 })
  const opening = page.getByTestId('booster-opening')
  await opening.getByTestId('pack').click()
  // No tray of 50 slots on a phone.
  await expect(opening.getByTestId('card-progress')).toBeVisible({ timeout: 15_000 })
  await expect(opening.getByTestId('card-slots')).toHaveCount(0)

  await opening.getByTestId('skip').click()
  await expect(opening.getByTestId('flip-card')).toHaveCount(50)
  // Flat cards: no tilt layer per card, and nothing makes the scene scroll sideways.
  await expect(opening.locator('.tilt-card')).toHaveCount(0)
  const scrollWidth = await opening.evaluate((element) => element.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(PHONE.width)
  await context.close()
})

test('admin pages fit a phone screen', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US', viewport: PHONE, hasTouch: true })
  await signInNewPlayer(context, 'Phone Admin', undefined, 'admin')
  const page = await context.newPage()
  const problems: string[] = []
  for (const path of ['/admin', '/admin/settings', '/admin/rarities', '/admin/users']) {
    const offenders = await horizontalOverflow(page, path, 'main h1')
    if (offenders.length) problems.push(`${path}: ${offenders.join(', ')}`)
  }
  expect(problems, problems.join('\n')).toEqual([])
  await context.close()
})
