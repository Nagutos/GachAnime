import { createAuthClient } from 'better-auth/vue'

/** Better Auth client; the API is served from the same origin under /api/auth. */
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
})

export function signInWithDiscord(): Promise<unknown> {
  return authClient.signIn.social({ provider: 'discord', callbackURL: '/' })
}
