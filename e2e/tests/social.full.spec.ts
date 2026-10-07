import { expect, test } from '@playwright/test'
import { giveCards, grantGems } from '../support/player-data'
import { signInNewPlayer } from '../support/session'

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: 120_000 })

test('two players complete a trade', async ({ browser }) => {
  const aliceContext = await browser.newContext({ locale: 'en-US' })
  const bobContext = await browser.newContext({ locale: 'en-US' })
  const alice = await signInNewPlayer(aliceContext, 'Alice Trader')
  const bob = await signInNewPlayer(bobContext, 'Bob Trader')
  const [aliceCard] = await giveCards(alice.userId, 1, 1, 0)
  const [bobCard] = await giveCards(bob.userId, 1, 2, 1)

  const alicePage = await aliceContext.newPage()
  await alicePage.goto(`/u/${bob.username}`)
  await alicePage.getByTestId('propose-trade').click({ timeout: 30_000 })
  await alicePage
    .getByTestId('my-cards')
    .getByTestId(`pick-${aliceCard}`)
    .click({ timeout: 30_000 })
  await alicePage.getByTestId('their-cards').getByTestId(`pick-${bobCard}`).click()
  // Alice gives her only copy: the last-copy warning shows.
  await expect(alicePage.getByTestId('last-copy-warning')).toBeVisible()
  await alicePage.getByTestId('send-trade').click()
  await expect(alicePage).toHaveURL(/\/trades$/)

  const bobPage = await bobContext.newPage()
  await bobPage.goto('/trades')
  await expect(bobPage.getByTestId('badge-trades')).toHaveText('1', { timeout: 30_000 })
  await bobPage.getByTestId('accept-trade').click()
  await expect(bobPage.getByTestId('toast').filter({ hasText: 'Handshake' })).toBeVisible({
    timeout: 30_000,
  })

  await bobPage.getByTestId('trades-history').click()
  await expect(bobPage.getByText('Accepted').first()).toBeVisible()
  await bobPage.goto(`/wiki/characters/${aliceCard}`)
  await expect(bobPage.getByTestId('wiki-name')).toBeVisible({ timeout: 30_000 })
  await aliceContext.close()
  await bobContext.close()
})

test('a player sells a card that another one buys', async ({ browser }) => {
  const sellerContext = await browser.newContext({ locale: 'en-US' })
  const buyerContext = await browser.newContext({ locale: 'en-US' })
  const seller = await signInNewPlayer(sellerContext, 'Seller')
  const buyer = await signInNewPlayer(buyerContext, 'Buyer')
  const [card] = await giveCards(seller.userId, 1, 2, 2)
  await grantGems(buyer.userId, 500)

  const sellerPage = await sellerContext.newPage()
  await sellerPage.goto(`/wiki/characters/${card}`)
  await sellerPage.getByTestId('sell-price').fill('300', { timeout: 30_000 })
  await sellerPage.getByTestId('sell-button').click()
  await expect(sellerPage.getByTestId('sell-panel')).toContainText('On sale!')

  const buyerPage = await buyerContext.newPage()
  await buyerPage.goto('/market')
  const listing = buyerPage.getByTestId('market-grid').locator('[data-testid^="listing-"]').first()
  await listing.getByTestId('buy-listing').click({ timeout: 30_000 })
  await buyerPage.getByTestId('confirm-buy').click()
  await expect(buyerPage.getByTestId('header-gems')).toHaveText('200 gems', { timeout: 30_000 })

  await sellerPage.goto('/gems')
  await expect(sellerPage.getByTestId('gem-balance')).toHaveText('300 gems', { timeout: 30_000 })
  await expect(sellerPage.locator('tbody tr').first()).toContainText('Market sale')
  await sellerContext.close()
  await buyerContext.close()
})
