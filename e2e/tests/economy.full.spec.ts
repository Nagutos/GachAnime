import { expect, test } from '@playwright/test'
import { giveCards, grantGems } from '../support/player-data'
import { signInNewPlayer } from '../support/session'

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 90_000 })

test('a player buys a paid booster, recycles duplicates and sees the gem history', async ({
  page,
  context,
}) => {
  const { userId } = await signInNewPlayer(context)
  await grantGems(userId, 200)
  // 3 characters × 3 copies: 6 duplicates to recycle.
  await giveCards(userId, 3, 3)

  await page.goto('/boosters')
  await expect(page.getByTestId('boosters-gems')).toHaveText('200 gems', { timeout: 30_000 })
  await expect(page.getByTestId('open-epic-5')).toBeDisabled()
  await page.getByTestId('open-epic-1').click()
  const opening = page.getByTestId('booster-opening')
  await opening.getByTestId('skip').click()
  await opening.getByTestId('close-opening').click()
  await expect(page.getByTestId('boosters-gems')).toHaveText('50 gems')

  await page.getByTestId('nav-collection').click()
  await page.getByTestId('open-recycle').click()
  const preview = page.getByTestId('recycle-preview')
  await expect(preview).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('recycle-confirm').click()
  await expect(page.getByTestId('recycle-done')).toContainText('cards recycled')
  await page.getByRole('button', { name: 'Close' }).first().click()

  await page.getByTestId('header-gems').click()
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(3, { timeout: 30_000 })
  await expect(rows.nth(0)).toContainText('Recycling')
  await expect(rows.nth(1)).toContainText('Booster purchase')
  await expect(rows.nth(2)).toContainText('Adjustment by an admin')
})

test('a player buys an upgrade and stores more free boosters', async ({ page, context }) => {
  const { userId } = await signInNewPlayer(context)
  await grantGems(userId, 1_500)

  await page.goto('/upgrades')
  const storage = page.getByTestId('upgrade-booster_storage')
  await expect(storage.getByTestId('upgrade-current')).toHaveText('None', { timeout: 30_000 })
  await expect(page.getByTestId('upgrade-buy-booster_speed')).toBeEnabled()
  await storage.getByTestId('upgrade-buy-booster_storage').click()
  await expect(storage.getByTestId('upgrade-current')).toHaveText('+2 boosters')
  await expect(page.getByTestId('upgrades-balance')).toHaveText('500 gems')
  // 1,000 gems for the next level: not enough left.
  await expect(storage.getByTestId('upgrade-buy-booster_storage')).toBeDisabled()

  await page.getByTestId('nav-boosters').click()
  await expect(page.getByTestId('charges')).toHaveText('15 / 17')

  await page.getByTestId('header-gems').click()
  await expect(page.locator('tbody tr').first()).toContainText('Upgrade purchase', {
    timeout: 30_000,
  })
})
