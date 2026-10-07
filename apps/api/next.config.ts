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
  output: 'standalone',
  outputFileTracingRoot: repositoryRoot,
  transpilePackages: ['@gachanime/core', '@gachanime/db', '@gachanime/shared'],
  serverExternalPackages: ['pg', 'pino'],
  poweredByHeader: false,
}

export default config
