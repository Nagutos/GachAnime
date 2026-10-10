import { expect, test } from '@playwright/test'
import { signInNewPlayer } from '../support/session'

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 90_000 })

test('a new player claims missions and unlocks achievements', async ({ page, context }) => {
  await signInNewPlayer(context)
  await page.goto('/missions')

  // The welcome mission is completed at sign-up.
  const welcome = page.getByTestId('mission-welcome')
  await expect(welcome).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('badge-missions')).toHaveText('1')
  await welcome.getByTestId('claim-mission').click()
  await expect(welcome).toBeHidden()
  await expect(page.getByTestId('header-gems')).toHaveText('300 gems')

  // Opening a booster completes the daily mission: a toast appears once the opening closes.
  await page.getByTestId('nav-boosters').click()
  await page.getByTestId('open-1').click()
  await page.getByTestId('booster-opening').getByTestId('skip').click()
  await expect(page.getByTestId('toast')).toHaveCount(0)
  await page.getByTestId('booster-opening').getByTestId('close-opening').click()
  await expect(
    page.getByTestId('toast').filter({ hasText: 'Open your first booster' }),
  ).toBeVisible()

  await page.getByTestId('nav-missions').click()
  const daily = page.getByTestId('mission-daily_open_booster')
  await daily.getByTestId('claim-mission').click()
  await expect(daily).toContainText('Claimed')
  await expect(page.getByTestId('header-gems')).toHaveText('330 gems')

  // Ten more boosters complete the "First Steps" achievement.
  await page.getByTestId('nav-boosters').click()
  await page.getByTestId('open-10').click()
  await page.getByTestId('booster-opening').getByTestId('skip').click()
  await page.getByTestId('booster-opening').getByTestId('close-opening').click()
  await expect(page.getByTestId('toast').filter({ hasText: 'First Steps' })).toBeVisible()
  // Toasts sit at the bottom right, over the claim buttons: close them first.
  const toasts = page.getByTestId('toast')
  await expect(async () => {
    // Toasts slide in and out: retry until none is left.
    if (await toasts.count()) {
      await toasts
        .first()
        .getByRole('button', { name: 'Close' })
        .click({ force: true, timeout: 1000 })
    }
    await expect(toasts).toHaveCount(0, { timeout: 500 })
  }).toPass({ timeout: 15_000 })

  // Achievements are in the user menu, its button shows what is left to claim.
  await expect(page.getByTestId('badge-user-menu')).toBeVisible()
  await page.getByTestId('user-menu').click()
  await expect(page.getByTestId('badge-achievements')).toBeVisible()
  await page.getByTestId('nav-achievements').click()
  const firstSteps = page.getByTestId('achievement-open_10')
  await firstSteps.getByTestId('claim-achievement').click()
  await expect(firstSteps).toContainText('Claimed')
  await expect(page.getByTestId('header-gems')).toHaveText('340 gems')
})
