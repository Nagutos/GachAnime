import { expect, test } from '@playwright/test'
import { signInNewPlayer } from '../support/session'

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 90_000 })

test('a new player claims missions, unlocks achievements and sends feedback', async ({
  page,
  context,
}) => {
  await signInNewPlayer(context)
  await page.goto('/missions')

  // The welcome mission is completed at sign-up.
  const welcome = page.getByTestId('mission-welcome')
  await expect(welcome).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('badge-missions')).toHaveText('1')
  await welcome.getByTestId('claim-mission').click()
  await expect(welcome).toBeHidden()
  await expect(page.getByTestId('header-gems')).toHaveText('30 gems')

  // Opening a booster completes the daily mission: a toast appears.
  await page.getByTestId('nav-boosters').click()
  await page.getByTestId('open-1').click()
  await page.getByTestId('booster-opening').getByTestId('skip').click()
  await expect(
    page.getByTestId('toast').filter({ hasText: 'Open your first booster' }),
  ).toBeVisible()
  await page.getByTestId('booster-opening').getByTestId('close-opening').click()

  await page.getByTestId('nav-missions').click()
  const daily = page.getByTestId('mission-daily_open_booster')
  await daily.getByTestId('claim-mission').click()
  await expect(daily).toContainText('Claimed')
  await expect(page.getByTestId('header-gems')).toHaveText('50 gems')

  // Feedback unlocks the "Critic" achievement.
  await page.goto('/feedback')
  await page.getByTestId('rating-5').click()
  await page.getByRole('textbox').fill('Great game!')
  await page.getByTestId('submit-feedback').click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Critic' })).toBeVisible({
    timeout: 30_000,
  })

  await page.getByTestId('nav-achievements').click()
  const critic = page.getByTestId('achievement-feedback_1')
  await critic.getByTestId('claim-achievement').click()
  await expect(critic).toContainText('Claimed')
  await expect(page.getByTestId('header-gems')).toHaveText('150 gems')
})
