import { expect, test } from '@playwright/test'

test.describe('home page (signed out)', () => {
  test.use({ locale: 'en-US' })

  test('shows the Discord sign-in button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('GachAnime')
    await expect(page.getByRole('button', { name: 'Sign in with Discord' })).toBeVisible()
  })

  test('switches language and remembers it', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('locale-switcher').locator('option')).toHaveText([
      'English',
      'Français',
    ])
    await page.getByTestId('locale-switcher').selectOption('fr')
    await expect(page.getByRole('button', { name: 'Se connecter avec Discord' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    await page.reload()
    await expect(page.getByRole('button', { name: 'Se connecter avec Discord' })).toBeVisible()
  })
})

test.describe('language detection', () => {
  test.use({ locale: 'fr-FR' })

  test('uses the browser language on first visit', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Se connecter avec Discord' })).toBeVisible()
  })
})

test('unknown routes show the not found page', async ({ page }) => {
  await page.goto('/does-not-exist')
  await expect(page.getByText('404')).toBeVisible()
})

test.describe('admin area (signed out)', () => {
  test.use({ locale: 'en-US' })

  test('is refused without an admin session', async ({ page }) => {
    await page.goto('/admin/series')
    await expect(page.getByText('This area is reserved for administrators.')).toBeVisible()
  })
})
