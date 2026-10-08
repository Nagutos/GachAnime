import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

// In development, read the single root `.env` shared by every app.
const rootEnvFile = `${repositoryRoot}.env`
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile)
}

const config: NextConfig = {
  // The e2e suite runs its own dev server next to `pnpm dev`: it needs a separate build folder.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  outputFileTracingRoot: repositoryRoot,
  transpilePackages: [
    '@gachanime/core',
    '@gachanime/db',
    '@gachanime/game',
    '@gachanime/importer',
    '@gachanime/shared',
  ],
  serverExternalPackages: ['pg', 'pino', 'sharp', 'bullmq'],
  poweredByHeader: false,
  // API responses are per-user data: never cached by browsers or proxies. Caddy adds the
  // page-level security headers (CSP, HSTS…) in front of everything.
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}

export default config
