import { expect, test, type Page } from '@playwright/test'
import { giveCards } from '../support/player-data'
import { baseUrl } from '../support/env'
import { signInNewPlayer } from '../support/session'

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 90_000 })

const order = (page: Page) =>
  page
    .getByTestId('favorites-grid')
    .locator('> li')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')))

test('a player stars cards, filters them and arranges the favorites', async ({ page, context }) => {
  const { userId, username } = await signInNewPlayer(context)
  const [a, b, c] = await giveCards(userId, 3, 1)

  // Star three cards from their wiki entries, in this order.
  for (const id of [a, b, c]) {
    await page.goto(`/wiki/characters/${id}`)
    const star = page.getByTestId('favorite-button')
    await star.click({ timeout: 30_000 })
    // The API dev server compiles the route on its first call.
    await expect(star).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 })
  }

  // The collection filter keeps only them.
  await page.goto('/collection')
  await page.getByTestId('filter-favorites').check({ timeout: 30_000 })
  await expect(page.getByTestId('collection-grid').getByTestId('character-card')).toHaveCount(3)

  // The favorites page lists them in the order they were added.
  await page.goto('/collection/favorites')
  await expect(page.getByTestId('favorites-count')).toHaveText('3 / 100 characters', {
    timeout: 30_000,
  })
  expect(await order(page)).toEqual([`favorite-${a}`, `favorite-${b}`, `favorite-${c}`])

  // Arrange: the arrows, then drag and drop; saved and kept after a reload.
  await page.getByTestId('favorites-arrange').click()
  await page.getByTestId(`favorite-${a}`).getByTestId('favorite-later').click()
  expect(await order(page)).toEqual([`favorite-${b}`, `favorite-${a}`, `favorite-${c}`])
  // Picked up and carried over the first card (once the arrow move has settled): the others
  // slide out of its way.
  await expect(page.getByTestId(`favorite-${b}`)).toHaveCSS('transform', 'none')
  const from = (await page.getByTestId(`favorite-${c}`).boundingBox())!
  const to = (await page.getByTestId(`favorite-${b}`).boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 3)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 3, { steps: 30 })
  await expect.poll(() => order(page)).toEqual([`favorite-${c}`, `favorite-${b}`, `favorite-${a}`])
  await page.mouse.up()
  await page.getByTestId('favorites-save').click()
  await expect(page.getByTestId('favorites-arrange')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('favorites-grid')).toBeVisible({ timeout: 30_000 })
  expect(await order(page)).toEqual([`favorite-${c}`, `favorite-${b}`, `favorite-${a}`])

  // The card size is a display choice; removing a favorite from the page.
  await page.getByTestId('favorites-size-large').click()
  await expect(page.getByTestId('favorites-size-large')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId(`favorite-${b}`).getByTestId('favorite-button').click()
  await expect(page.getByTestId('favorites-count')).toHaveText('2 / 100 characters')

  // The profile shows them as a showcase, the first one next to the name.
  await page.goto(`/u/${username}`)
  const showcase = page.getByTestId('profile-showcase')
  await expect(showcase.getByTestId('character-card')).toHaveCount(2, { timeout: 30_000 })
  await expect(page.getByTestId('featured-card')).toBeVisible()
})

test('a card held where four cards meet does not keep reordering the grid', async ({
  page,
  context,
}) => {
  const { userId } = await signInNewPlayer(context)
  for (const id of await giveCards(userId, 14, 1)) {
    const response = await context.request.put(`/api/v1/favorites/${id}`, {
      headers: { Origin: baseUrl },
    })
    expect(response.ok()).toBe(true)
  }
  await page.goto('/collection/favorites')
  await page.getByTestId('favorites-arrange').click({ timeout: 30_000 })
  const grid = page.getByTestId('favorites-grid')
  await grid.evaluate((element) => {
    const counter = window as unknown as { reorders: number }
    counter.reorders = 0
    new MutationObserver(() => counter.reorders++).observe(element, { childList: true })
  })
  const items = grid.locator('> li')
  const [first, second, below, start] = await Promise.all(
    [0, 1, 7, 9].map(async (index) => (await items.nth(index).boundingBox())!),
  )
  // The corner between the first two cards of the first two rows.
  const corner = {
    x: (first!.x + first!.width + second!.x) / 2,
    y: (first!.y + first!.height + below!.y) / 2,
  }
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
  await page.mouse.down()
  await page.mouse.move(corner.x, corner.y, { steps: 40 })
  // Wiggling on the spot: the order settles instead of cycling around the corner.
  for (let step = 0; step < 60; step++) {
    await page.mouse.move(corner.x + (step % 2 ? 2 : -2), corner.y + (step % 2 ? 2 : -2))
  }
  const reorders = await page.evaluate(() => (window as unknown as { reorders: number }).reorders)
  expect(reorders).toBeLessThan(10)
  await page.mouse.up()
})
