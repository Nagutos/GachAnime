const store = globalThis as typeof globalThis & { __gachanime?: Map<string, unknown> }

/** Process-wide singleton that survives Next.js hot reloads in development. */
export function singleton<T>(key: string, create: () => T): T {
  store.__gachanime ??= new Map()
  if (!store.__gachanime.has(key)) store.__gachanime.set(key, create())
  return store.__gachanime.get(key) as T
}
