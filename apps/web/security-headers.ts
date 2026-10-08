/**
 * Security headers of the web app. Production serves them from `docker/Caddyfile`; `vite preview`
 * (the e2e target) sends the same ones so that a CSP regression fails the e2e suite. A unit test
 * checks that both stay identical.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Inline `style` attributes are used by Vue transitions and Reka UI positioning.
  "style-src 'self' 'unsafe-inline'",
  // AniList and IGDB pictures and Discord avatars are hotlinked unless the image cache is enabled.
  "img-src 'self' data: blob: https://*.anilist.co https://images.igdb.com https://cdn.discordapp.com",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}
