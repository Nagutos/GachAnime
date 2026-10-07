import { useQueryClient } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMeQuery, useUpdateLocaleMutation } from '@/api/me'
import { availableLocales } from '@/locales'
import { authClient } from './auth'
import { applyLocale } from './i18n'

/**
 * Current player + locale synchronization:
 * - signed out: the device locale is used;
 * - signed in: the profile locale wins; if the profile has none yet, the device one is saved.
 */
export function useSession() {
  const session = authClient.useSession()
  const isSignedIn = computed(() => Boolean(session.value.data?.user))
  const me = useMeQuery(isSignedIn)
  const updateLocale = useUpdateLocaleMutation()
  const { locale } = useI18n()
  const queryClient = useQueryClient()

  watch(
    () => me.data.value,
    (profile) => {
      if (!profile) return
      if (profile.locale && availableLocales.includes(profile.locale)) applyLocale(profile.locale)
      else updateLocale.mutate(locale.value)
    },
  )

  async function changeLocale(next: string): Promise<void> {
    applyLocale(next)
    if (isSignedIn.value) await updateLocale.mutateAsync(next)
  }

  async function signOut(): Promise<void> {
    await authClient.signOut()
    queryClient.clear()
  }

  return {
    isPending: computed(() => session.value.isPending),
    isSignedIn,
    me: me.data,
    changeLocale,
    signOut,
  }
}
