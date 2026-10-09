import { expect, test, type Locator } from '@playwright/test'
import { E2E_SERIES_TITLE } from '../support/catalog'
import { signInNewPlayer } from '../support/session'

test.use({ locale: 'en-US' })
// The API dev server compiles each route on its first request.
test.setTimeout(90_000)
test.describe.configure({ timeout: 90_000 })

test('a new player opens a free booster, then finds the cards in the collection and the wiki', async ({
  page,
  context,
}) => {
  await signInNewPlayer(context)
  await page.goto('/')
  await expect(page.getByTestId('welcome')).toBeVisible({ timeout: 30_000 })

  await page.getByTestId('cta-boosters').click()
  // New players start with every free charge.
  await expect(page.getByTestId('charges')).toHaveText('15 / 15', { timeout: 30_000 })
  await page.getByTestId('open-1').click()

  const opening = page.getByTestId('booster-opening')
  await opening.getByTestId('pack').click()
  await opening.getByTestId('reveal-all').click()
  const revealed = opening.locator('[data-testid="flip-card"][data-revealed="true"]')
  await expect(revealed).toHaveCount(5)
  const characterId = await revealed.first().getAttribute('data-character-id')
  expect(characterId).toBeTruthy()
  await opening.getByTestId('close-opening').click()
  await expect(opening).toBeHidden()
  await expect(page.getByTestId('charges')).toHaveText('14 / 15')

  // Collection: the drawn cards are there.
  await page.getByTestId('nav-collection').click()
  const grid = page.getByTestId('collection-grid')
  await expect(grid.getByTestId('character-card').first()).toBeVisible({ timeout: 30_000 })
  const owned = await grid.getByTestId('character-card').count()
  expect(owned).toBeGreaterThanOrEqual(1)
  expect(owned).toBeLessThanOrEqual(5)

  // The series under a card opens the collection of that series.
  await grid.getByTestId('card-series-link').first().click()
  await expect(page).toHaveURL(/[?&]series=\d+/)
  await expect(page.getByRole('button', { name: new RegExp(E2E_SERIES_TITLE) })).toBeVisible()
  await expect(grid.getByTestId('character-card')).toHaveCount(owned)

  // Wiki entry of a drawn character is unlocked.
  await page.goto(`/wiki/characters/${characterId}`)
  await expect(page.getByTestId('wiki-name')).toHaveText(/^Student \d\d$/, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Show spoiler' })).toBeVisible()
  // The card turns over on click, like in an opening.
  const turnable = page.getByTestId('turnable-card')
  await turnable.click()
  await expect(turnable).toHaveAttribute('aria-pressed', 'true')
  await turnable.click()
  await expect(turnable).toHaveAttribute('aria-pressed', 'false')

  // The series page shows every character; locked ones are greyed, with a wishlist shortcut.
  await page.getByRole('link', { name: E2E_SERIES_TITLE }).click()
  await expect(page.getByTestId('series-title')).toHaveText(E2E_SERIES_TITLE, { timeout: 30_000 })
  const entries = page.getByTestId('wiki-entries')
  await expect(entries.getByTestId('character-card')).toHaveCount(20)
  await expect(entries.getByTestId('locked-card')).toHaveCount(20 - owned)
  await expect(entries.getByTestId('locked-card').first()).toContainText(/Student \d\d/)
  await expect(entries.getByTestId('wishlist-button')).toHaveCount(20)
})

test('cards are revealed one by one, then all laid out', async ({ page, context }) => {
  await signInNewPlayer(context, 'One By One')
  await page.goto('/boosters')
  await page.getByTestId('open-1').click({ timeout: 30_000 })
  const opening = page.getByTestId('booster-opening')
  await opening.getByTestId('pack').click()

  const revealed = opening.locator('[data-testid="flip-card"][data-revealed="true"]')
  const filledSlots = opening.getByTestId('card-slots').locator('[data-filled="true"]')
  await expect(opening.getByTestId('card-slots').locator('li')).toHaveCount(5)
  for (let index = 1; index <= 5; index++) {
    await expect(opening.getByTestId('card-progress')).toHaveText(`Card ${index} of 5`)
    // Wait until the previous card has flown away and the next one is face down.
    await expect(revealed).toHaveCount(0)
    await expect(opening.getByTestId('flip-card')).toHaveCount(1)
    // A real mouse click at the card center (the card sways, so Playwright never sees it
    // "stable"; a forced click would skip the hit testing that once sent clicks elsewhere).
    const box = (await opening.getByTestId('flip-card').boundingBox())!
    if (index === 1) {
      // Fully tilted (pointer near a corner), every point of the card must still hit the card.
      await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1)
      await page.waitForTimeout(300)
      const misses = await page.evaluate(
        ({ x, y, width, height }) =>
          [0.3, 0.5, 0.7]
            .flatMap((fx) => [0.3, 0.5, 0.7].map((fy) => [x + width * fx, y + height * fy]))
            .filter(
              ([px, py]) =>
                !document.elementFromPoint(px!, py!)?.closest('[data-testid="flip-card"]'),
            ).length,
        box,
      )
      expect(misses).toBe(0)

      // Face down, the card cannot be dragged away: it stays in place under the pointer.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2, { steps: 8 })
      const dragged = (await opening.getByTestId('flip-card').boundingBox())!
      expect(Math.abs(dragged.x - box.x)).toBeLessThan(30)
      await page.mouse.up()
      await expect(revealed).toHaveCount(0)
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(revealed).toHaveCount(1)
    // Each revealed card fills its slot.
    await expect(filledSlots).toHaveCount(index)
    if (index === 2) {
      // The browser must not start its own drag of the picture (save image) instead of the swipe.
      const pictures = opening.locator('[data-testid="flip-card"][data-revealed="true"] img')
      for (const draggable of await pictures.evaluateAll((images) =>
        images.map((image) => (image as HTMLImageElement).draggable),
      ))
        expect(draggable).toBe(false)
      // Swiping the revealed card away (here to the left) brings the next one, once it has
      // turned (mid-flip, the card is edge-on and the pointer goes through).
      await page.waitForTimeout(600)
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await page.mouse.move(center.x, center.y)
      await page.mouse.down()
      await page.mouse.move(center.x - 220, center.y + 30, { steps: 12 })
      await page.mouse.up()
    } else if (index === 3) {
      await page.keyboard.press('ArrowUp')
    } else {
      await opening.getByTestId('next-card').click()
    }
  }

  // After the last card, the whole pack is laid out face up, from the most common to the rarest.
  await expect(revealed).toHaveCount(5)
  await expectRarityOrder(revealed)
  await opening.getByTestId('close-opening').click()
  await expect(opening).toBeHidden()
})

test('a ×5 opening tears a single pack and deals its 25 cards', async ({ page, context }) => {
  await signInNewPlayer(context, 'Five Packs')
  await page.goto('/boosters')
  await page.getByTestId('open-5').click({ timeout: 30_000 })
  const opening = page.getByTestId('booster-opening')
  await expect(opening.getByTestId('pack')).toHaveCount(1)
  await opening.getByTestId('pack').click()
  await expect(opening.getByTestId('card-progress')).toHaveText('Card 1 of 25')
  await expect(opening.getByTestId('card-slots').locator('li')).toHaveCount(25)
  await opening.getByTestId('reveal-all').click()
  const revealed = opening.locator('[data-testid="flip-card"][data-revealed="true"]')
  await expect(revealed).toHaveCount(25, { timeout: 15_000 })
  await expectRarityOrder(revealed)
  await opening.getByTestId('close-opening').click()
  await expect(opening).toBeHidden()
})

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic']

/** Cards come from the most common to the rarest. */
async function expectRarityOrder(cards: Locator): Promise<void> {
  const ranks = (
    await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-rarity')),
    )
  ).map((rarity) => RARITY_ORDER.indexOf(rarity ?? ''))
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
}
