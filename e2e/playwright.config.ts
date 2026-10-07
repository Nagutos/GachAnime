import { defineConfig, devices } from '@playwright/test'
import { API_PORT, baseUrl, e2eDatabaseUrl, fullStack, WEB_PORT } from './support/env'

/**
 * E2E tests run against the built web app (`vite preview`). When Postgres, Redis and an auth
 * secret are configured (see support/env.ts), player flows also run: a dedicated API dev server
 * on port 3100 uses its own database (`<test db>_e2e`) and the preview proxies `/api` to it.
 */
const webServer = {
  command: 'pnpm --filter @gachanime/web build && pnpm --filter @gachanime/web preview',
  url: `http://localhost:${WEB_PORT}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
}

const apiServer = {
  command: `pnpm --filter @gachanime/api exec next dev --port ${API_PORT}`,
  // Answers 401 without a session (accepted as ready). /health would fail: Playwright starts web
  // servers before globalSetup creates the e2e database.
  url: `http://localhost:${API_PORT}/api/v1/me`,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
  env: {
    NEXT_DIST_DIR: '.next-e2e',
    PUBLIC_URL: baseUrl,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || 'e2e',
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || 'e2e',
    LOG_LEVEL: 'warn',
  },
}

export default defineConfig({
  testDir: './tests',
  // Player flows need the full stack (`*.full.spec.ts`).
  testIgnore: fullStack ? [] : ['**/*.full.spec.ts'],
  globalSetup: './support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : fullStack
      ? [{ ...apiServer, env: { ...apiServer.env, DATABASE_URL: e2eDatabaseUrl() } }, webServer]
      : [webServer],
})
