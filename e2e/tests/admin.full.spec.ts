import { expect, test } from '@playwright/test'
import { setRoleInDatabase } from '../support/player-data'
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

test('a player promoted after signing in can administrate without signing in again', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'en-US' })
  // The session is created (and cached) while the account is still a plain player.
  const promoted = await signInNewPlayer(context, 'Late Admin')
  const target = await signInNewPlayer(await browser.newContext(), 'Late Target')
  expect((await context.request.get('/api/v1/admin/users')).status()).toBe(403)
  await setRoleInDatabase(promoted.userId, 'admin')

  // A settings write (the current value, so parallel tests are not affected).
  const settings = await context.request.get('/api/v1/admin/settings')
  expect(settings.status()).toBe(200)
  const offers = (await settings.json())['trades.offers']
  const saved = await context.request.put('/api/v1/admin/settings/trades.offers', { data: offers })
  expect(saved.status()).toBe(200)

  // Role changes and bans also work for this admin (they used to check the cached session).
  const ban = await context.request.patch(`/api/v1/admin/users/${target.userId}`, {
    data: { banned: true, banReason: 'test' },
  })
  expect(ban.status()).toBe(200)
  expect((await ban.json()).banned).toBe(true)
  await context.close()
})

test('video game imports explain how to enable IGDB when it is not configured', async ({
  browser,
}) => {
  // The e2e API reads the root .env: with IGDB credentials there, this case does not apply.
  test.skip(Boolean(process.env.IGDB_CLIENT_ID), 'IGDB is configured locally')
  const context = await browser.newContext({ locale: 'en-US' })
  await signInNewPlayer(context, 'Import Admin', undefined, 'admin')
  const page = await context.newPage()
  await page.goto('/admin/imports')
  await page.getByTestId('import-source-igdb').click({ timeout: 30_000 })
  await expect(page.getByTestId('igdb-not-configured')).toContainText('IGDB_CLIENT_ID')
  await expect(page.getByRole('button', { name: 'Start import' })).toBeDisabled()

  const refused = await context.request.post('/api/v1/admin/imports', {
    data: { mode: 'igdb_top', top: 5 },
  })
  expect(refused.status()).toBe(409)
  expect((await refused.json()).error.code).toBe('IGDB_NOT_CONFIGURED')
  await context.close()
})
