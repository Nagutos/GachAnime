// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SECURITY_HEADERS } from './security-headers'

const caddyfile = readFileSync(new URL('../../docker/Caddyfile', import.meta.url), 'utf8')

describe('security headers', () => {
  it.each(Object.entries(SECURITY_HEADERS))('Caddy serves the same %s', (name, value) => {
    expect(caddyfile).toContain(`${name} "${value}"`)
  })
})
