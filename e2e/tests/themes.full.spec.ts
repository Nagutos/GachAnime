import { expect, test } from '@playwright/test'
import { e2eDatabaseUrl } from '../support/env'
import { grantGems } from '../support/player-data'
import { signInNewPlayer } from '../support/session'

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 90_000 })

// The e2e catalog alternates female (odd student numbers) and male characters.
const FEMALE = /^Student (0[13579]|1[13579])$/

test('packs are free boosters of their own; premium boosters draw from the whole catalog', async ({
  page,
  context,
}) => {
  const { userId } = await signInNewPlayer(context)
  await grantGems(userId, 150)
  await page.goto('/boosters')

  await page.getByTestId('pack-waifus').click({ timeout: 30_000 })
  await expect(page.getByTestId('pack-summary')).toHaveText('Waifus')
  // Premium boosters keep their own price: no pack, no surcharge.
  await expect(page.getByTestId('tier-epic')).toContainText('150 gems per booster')

  await page.getByTestId('open-5').click()
  const opening = page.getByTestId('booster-opening')
  await expect(opening.getByRole('heading', { name: 'Waifus' })).toBeVisible()
  await opening.getByTestId('skip').click()
  const cards = opening.getByTestId('opening-summary').getByTestId('character-card')
  await expect(cards).toHaveCount(25)
  const names = await cards.locator('p.font-bold').allTextContents()
  for (const name of names) expect(name).toMatch(FEMALE)
  await opening.getByTestId('close-opening').click()

  await page.getByTestId('open-epic-1').click()
  await expect(opening.getByRole('heading', { name: 'Epic booster' })).toBeVisible()
  await opening.getByTestId('skip').click()
  await opening.getByTestId('close-opening').click()
  await expect(page.getByTestId('boosters-gems')).toHaveText('0 gems')
})

test('an admin builds a pack with the rule editor and its live preview', async ({
  page,
  context,
}) => {
  await signInNewPlayer(context, 'E2E Admin', e2eDatabaseUrl(), 'admin')
  const key = `e2e-pack-${Date.now()}`
  await page.goto('/admin/themes/new')
  await page.getByTestId('theme-key').fill(key)
  await page.getByLabel('Name (en)').fill('E2E boys')
  await page.getByTestId('add-rule-gender').click()
  await page.getByRole('combobox', { name: 'Gender', exact: true }).click()
  await page.getByRole('option', { name: 'Male', exact: true }).click()
  await expect(page.getByTestId('theme-preview')).toContainText('10 characters', {
    timeout: 30_000,
  })
  await page.getByTestId('save-theme').click()
  await expect(page).toHaveURL(/\/admin\/themes\/\d+$/)

  // A new pack comes last in the shop; the admin moves it first.
  await page.goto('/admin/themes')
  const rows = page.locator('tbody tr')
  await expect(rows.last()).toHaveAttribute('data-testid', `theme-row-${key}`)
  const moveUp = page.getByTestId(`theme-row-${key}`).getByRole('button', { name: /^Move .* up$/ })
  while (await moveUp.isEnabled()) await moveUp.click()
  await expect(rows.first()).toHaveAttribute('data-testid', `theme-row-${key}`)
  await page.getByTestId('save-theme-order').click()
  await expect(page.getByText('Order saved')).toBeVisible()

  await page.goto('/boosters')
  const packs = page.getByTestId('pack-selector').getByRole('radio')
  // The whole catalog first, then the packs in the admin's order.
  await expect(packs.nth(1)).toHaveAttribute('data-testid', `pack-${key}`, { timeout: 30_000 })
})
