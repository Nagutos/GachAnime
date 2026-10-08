import { expect, test } from '@playwright/test'
import { baseUrl } from '../support/env'
import { signInNewPlayer } from '../support/session'

/** Abuse checks against the real API (through the preview proxy). */

const PLAYER_READS = [
  '/api/v1/me',
  '/api/v1/boosters',
  '/api/v1/collection',
  '/api/v1/gems',
  '/api/v1/missions',
  '/api/v1/achievements',
  '/api/v1/trades',
  '/api/v1/market',
  '/api/v1/players',
  '/api/v1/wiki/series',
]

const PLAYER_WRITES: [method: 'POST' | 'PUT', path: string][] = [
  ['POST', '/api/v1/boosters/open'],
  ['POST', '/api/v1/recycle'],
  ['POST', '/api/v1/missions/claim'],
  ['POST', '/api/v1/trades'],
  ['POST', '/api/v1/market'],
  ['POST', '/api/v1/market/1/buy'],
  ['PUT', '/api/v1/wishlist/1'],
]

const ADMIN_ROUTES: [method: 'GET' | 'POST' | 'PATCH' | 'PUT', path: string][] = [
  ['GET', '/api/v1/admin/users'],
  ['GET', '/api/v1/admin/settings'],
  ['GET', '/api/v1/admin/audit-log'],
  ['GET', '/api/v1/admin/catalog/stats'],
  ['POST', '/api/v1/admin/imports'],
  ['PATCH', '/api/v1/admin/users/someone'],
  ['PUT', '/api/v1/admin/settings/boosters.free'],
  ['POST', '/api/v1/admin/rosters'],
]

test('player routes require a session', async ({ request }) => {
  for (const path of PLAYER_READS) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(401)
  }
  for (const [method, path] of PLAYER_WRITES) {
    const response = await request.fetch(path, { method, data: {} })
    expect(response.status(), `${method} ${path}`).toBe(401)
    expect((await response.json()).error.code).toBe('UNAUTHENTICATED')
  }
})

test('admin routes refuse players', async ({ browser }) => {
  const context = await browser.newContext()
  await signInNewPlayer(context, 'Not An Admin')
  for (const [method, path] of ADMIN_ROUTES) {
    const response = await context.request.fetch(path, { method, data: {} })
    expect(response.status(), `${method} ${path}`).toBe(403)
    expect((await response.json()).error.code).toBe('FORBIDDEN')
  }
  await context.close()
})

test('cross-origin mutations are rejected even with a valid session', async ({ browser }) => {
  const context = await browser.newContext()
  await signInNewPlayer(context, 'Csrf Target')
  const forged = await context.request.post('/api/v1/boosters/open', {
    headers: { origin: 'https://evil.example' },
    data: { tier: 'free', quantity: 1 },
  })
  expect(forged.status()).toBe(403)

  const sameOrigin = await context.request.patch('/api/v1/me', {
    headers: { origin: new URL(baseUrl).origin },
    data: { locale: 'fr' },
  })
  expect(sameOrigin.status()).toBe(200)
  await context.close()
})

test('sensitive routes are rate limited per player', async ({ browser }) => {
  const context = await browser.newContext()
  await signInNewPlayer(context, 'Spammer')
  const statuses: number[] = []
  // profileUpdate policy: 20 requests per minute.
  for (let index = 0; index < 22; index++) {
    const response = await context.request.patch('/api/v1/me', { data: { locale: 'en' } })
    statuses.push(response.status())
  }
  expect(statuses.slice(0, 20).every((status) => status === 200)).toBe(true)
  expect(statuses.at(-1)).toBe(429)
  const limited = await context.request.patch('/api/v1/me', { data: { locale: 'en' } })
  const body = await limited.json()
  expect(body.error.code).toBe('RATE_LIMITED')
  expect(body.error.details.retryAfterSeconds).toBeGreaterThan(0)
  await context.close()
})

test('API responses are never cached', async ({ request }) => {
  const response = await request.get('/api/v1/me')
  expect(response.headers()['cache-control']).toContain('no-store')
})
