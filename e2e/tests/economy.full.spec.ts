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
