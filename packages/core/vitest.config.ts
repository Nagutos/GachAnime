import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Local runs pick TEST_DATABASE_URL from the root .env; CI sets it explicitly.
const rootEnv = new URL('../../.env', import.meta.url)
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

export default defineConfig({
  test: {
    // Integration tests share one database: run files sequentially.
    fileParallelism: false,
  },
})
