import { meResponseSchema, type MeResponse } from '@gachanime/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { apiFetch } from './client'

export const meQueryKey = ['me'] as const

export function useMeQuery(enabled: Ref<boolean>) {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => apiFetch('/me', { schema: meResponseSchema }),
    enabled: computed(() => enabled.value),
  })
}

export function useUpdateLocaleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (locale: string) =>
      apiFetch('/me', { method: 'PATCH', body: { locale }, schema: meResponseSchema }),
    onSuccess: (me: MeResponse) => queryClient.setQueryData(meQueryKey, me),
  })
}
