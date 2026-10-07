import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const MEDIA_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
}

/** Serves uploaded images under /media in dev and preview, like Caddy does in production. */
function serveUploads(): Plugin {
  const root = process.env.UPLOADS_DIR ?? fileURLToPath(new URL('../../uploads', import.meta.url))
  const handler: Connect.NextHandleFunction = (request, response, next) => {
    const path = normalize(decodeURIComponent((request.url ?? '/').split('?')[0]!))
    const type = MEDIA_TYPES[extname(path).toLowerCase()]
    const file = join(root, path)
    if (!type || !file.startsWith(root)) return next()
    try {
      if (!statSync(file).isFile()) return next()
    } catch {
      return next()
    }
    response.setHeader('content-type', type)
    createReadStream(file).pipe(response)
  }
  return {
    name: 'gachanime-uploads',
    configureServer: (server) => void server.middlewares.use('/media', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/media', handler),
  }
}

export default defineConfig({
  plugins: [
    serveUploads(),
    vue(),
    tailwindcss(),
    VueI18nPlugin({
      include: [fileURLToPath(new URL('./src/locales/*.json', import.meta.url))],
      runtimeOnly: true,
      compositionOnly: true,
      strictMessage: false,
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Same-origin in development too: the API is proxied like Caddy does in production.
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000' },
  },
  test: {
    environment: 'happy-dom',
  },
})
