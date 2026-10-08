import { expect, test } from '@playwright/test'
import { signInNewPlayer } from '../support/session'

/** Admin critical paths: an audited settings change, and a ban that ends the player's session. */

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 120_000 })

test('an admin setting change is saved and audited', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  await signInNewPlayer(context, 'Settings Admin', undefined, 'admin')
  const page = await context.newPage()
  await page.goto('/admin/settings')
  const imageCache = page.getByTestId('image-cache-enabled')
  await imageCache.waitFor({ timeout: 30_000 })
  const form = page.locator('form').filter({ has: imageCache })
  await imageCache.setChecked(true)
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByText('Saved.')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('image-cache-enabled')).toBeChecked({ timeout: 30_000 })
  await imageCache.setChecked(false)
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByText('Saved.')).toBeVisible()

  await page.goto('/admin/audit')
  await expect(page.locator('tbody tr').filter({ hasText: 'Settings Admin' }).first()).toBeVisible({
    timeout: 30_000,
  })
  await context.close()
})

test('a banned player is signed out', async ({ browser }) => {
  const adminContext = await browser.newContext({ locale: 'en-US' })
  const playerContext = await browser.newContext({ locale: 'en-US' })
  await signInNewPlayer(adminContext, 'Ban Hammer', undefined, 'admin')
  const player = await signInNewPlayer(playerContext, 'Soon Banned')
  expect((await playerContext.request.get('/api/v1/me')).status()).toBe(200)

  const page = await adminContext.newPage()
  await page.goto('/admin/users')
  await page.getByRole('searchbox').fill(player.username)
  const row = page.locator('tbody tr').filter({ hasText: `@${player.username}` })
  await row.getByRole('button', { name: 'Ban' }).click({ timeout: 30_000 })
  await page.getByRole('dialog').getByRole('textbox').fill('e2e')
  await page.getByTestId('confirm-button').click()
  await expect(row.getByText('Banned · e2e')).toBeVisible({ timeout: 30_000 })

  expect((await playerContext.request.get('/api/v1/me')).status()).toBe(401)
  await adminContext.close()
  await playerContext.close()
})
