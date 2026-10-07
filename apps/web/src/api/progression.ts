import {
  achievementsResponseSchema,
  claimResultSchema,
  missionsResponseSchema,
  myFeedbackResponseSchema,
  progressionSummarySchema,
  submitFeedbackResponseSchema,
  type ClaimMissionRequest,
  type FeedbackRequest,
} from '@gachanime/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { notifyProgression } from '@/app/toasts'
import { apiFetch, toQueryString } from './client'
import { meQueryKey } from './me'

export const progressionKeys = {
  missions: ['missions'] as const,
  achievements: ['achievements'] as const,
  summary: ['progression-summary'] as const,
  feedback: ['feedback'] as const,
}

/** After an action that may have advanced missions or achievements. */
export function invalidateProgression(queryClient: ReturnType<typeof useQueryClient>): void {
  for (const key of Object.values(progressionKeys)) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}

function invalidateAfterClaim(queryClient: ReturnType<typeof useQueryClient>): void {
  invalidateProgression(queryClient)
  for (const key of [meQueryKey, ['gems'], ['boosters']]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}

export function useMissionsQuery() {
  return useQuery({
    queryKey: progressionKeys.missions,
    queryFn: () => apiFetch('/missions', { schema: missionsResponseSchema }),
  })
}

export function useClaimMissionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClaimMissionRequest) =>
      apiFetch('/missions/claim', { method: 'POST', body: input, schema: claimResultSchema }),
    onSettled: () => invalidateAfterClaim(queryClient),
  })
}

export function useAchievementsQuery(status: MaybeRefOrGetter<'all' | 'todo' | 'completed'>) {
  return useQuery({
    queryKey: computed(() => [...progressionKeys.achievements, toValue(status)]),
    queryFn: () =>
      apiFetch(`/achievements${toQueryString({ status: toValue(status) })}`, {
        schema: achievementsResponseSchema,
      }),
  })
}

export function useClaimAchievementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/achievements/${id}/claim`, { method: 'POST', schema: claimResultSchema }),
    onSettled: () => invalidateAfterClaim(queryClient),
  })
}

export function useProgressionSummaryQuery(enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: progressionKeys.summary,
    queryFn: () => apiFetch('/progression/summary', { schema: progressionSummarySchema }),
    enabled: computed(() => toValue(enabled)),
    refetchInterval: 60_000,
  })
}

export function useMyFeedbackQuery() {
  return useQuery({
    queryKey: progressionKeys.feedback,
    queryFn: () => apiFetch('/feedback', { schema: myFeedbackResponseSchema }),
  })
}

export function useSubmitFeedbackMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FeedbackRequest) =>
      apiFetch('/feedback', { method: 'PUT', body: input, schema: submitFeedbackResponseSchema }),
    onSuccess: (result) => {
      queryClient.setQueryData(progressionKeys.feedback, { feedback: result.feedback })
      notifyProgression(result.progression)
      invalidateProgression(queryClient)
    },
  })
}
