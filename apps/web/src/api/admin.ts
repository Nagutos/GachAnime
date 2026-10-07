import {
  adminAchievementsResponseSchema,
  adminBoosterTiersResponseSchema,
  adminFeedbackListSchema,
  adminMissionsResponseSchema,
  adminCharacterDetailSchema,
  adminRaritiesResponseSchema,
  adminSettingsSchema,
  updateRarityResultSchema,
  adminCharacterListSchema,
  adminRarityStatsSchema,
  adminSeriesDetailSchema,
  adminSeriesListSchema,
  anilistSearchResponseSchema,
  auditLogListSchema,
  idResponseSchema,
  imageUploadResultSchema,
  importJobDtoSchema,
  importJobListSchema,
  rosterImportResultSchema,
  type AdminCharactersQuery,
  type AdminSeriesQuery,
  type CreateImportRequest,
  type CreateManualCharacterRequest,
  type CreateManualSeriesRequest,
  type RosterImportInput,
  type AdminSettings,
  type CreateAchievementRequest,
  type CreateMissionRequest,
  type UpdateAchievementRequest,
  type UpdateMissionRequest,
  type UpdateBoosterTierRequest,
  type UpdateCharacterRequest,
  type UpdateRarityRequest,
  type UpdateSeriesRequest,
} from '@gachanime/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { z } from 'zod'
import { apiFetch, toQueryString } from './client'

export type SeriesFilters = Partial<AdminSeriesQuery>
export type CharacterFilters = Partial<AdminCharactersQuery>

export const adminKeys = {
  all: ['admin'] as const,
  stats: ['admin', 'stats'] as const,
  series: ['admin', 'series'] as const,
  seriesDetail: (id: number) => ['admin', 'series', 'detail', id] as const,
  characters: ['admin', 'characters'] as const,
  imports: ['admin', 'imports'] as const,
  audit: ['admin', 'audit'] as const,
  settings: ['admin', 'settings'] as const,
  rarities: ['admin', 'rarities'] as const,
  tiers: ['admin', 'tiers'] as const,
  missions: ['admin', 'missions'] as const,
  achievements: ['admin', 'achievements'] as const,
  feedback: ['admin', 'feedback'] as const,
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useCatalogStatsQuery() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: () => apiFetch('/admin/catalog/stats', { schema: adminRarityStatsSchema }),
  })
}

export function useSeriesListQuery(filters: MaybeRefOrGetter<SeriesFilters>) {
  return useQuery({
    queryKey: computed(() => [...adminKeys.series, 'list', toValue(filters)]),
    queryFn: () =>
      apiFetch(`/admin/series${toQueryString(toValue(filters))}`, {
        schema: adminSeriesListSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useSeriesDetailQuery(id: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => adminKeys.seriesDetail(toValue(id))),
    queryFn: () => apiFetch(`/admin/series/${toValue(id)}`, { schema: adminSeriesDetailSchema }),
  })
}

export function useCharacterListQuery(filters: MaybeRefOrGetter<CharacterFilters>) {
  return useQuery({
    queryKey: computed(() => [...adminKeys.characters, 'list', toValue(filters)]),
    queryFn: () =>
      apiFetch(`/admin/characters${toQueryString(toValue(filters))}`, {
        schema: adminCharacterListSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useCharacterDetailQuery(id: MaybeRefOrGetter<number | null>) {
  return useQuery({
    queryKey: computed(() => [...adminKeys.characters, 'detail', toValue(id)]),
    queryFn: () =>
      apiFetch(`/admin/characters/${toValue(id)}`, { schema: adminCharacterDetailSchema }),
    enabled: computed(() => toValue(id) !== null),
  })
}

/** Polls while an import is queued or running. */
export function useImportJobsQuery() {
  return useQuery({
    queryKey: adminKeys.imports,
    queryFn: () => apiFetch('/admin/imports', { schema: importJobListSchema }),
    refetchInterval: (query) =>
      query.state.data?.items.some((job) => job.status === 'queued' || job.status === 'running')
        ? 3000
        : false,
  })
}

export function useAniListSearchQuery(search: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => ['admin', 'anilist', toValue(search)]),
    queryFn: () =>
      apiFetch(`/admin/anilist/search${toQueryString({ q: toValue(search) })}`, {
        schema: anilistSearchResponseSchema,
      }),
    enabled: computed(() => toValue(search).trim().length >= 2),
    staleTime: 5 * 60_000,
  })
}

export function useAuditLogQuery(filters: MaybeRefOrGetter<{ page: number; targetType?: string }>) {
  return useQuery({
    queryKey: computed(() => [...adminKeys.audit, toValue(filters)]),
    queryFn: () =>
      apiFetch(`/admin/audit-log${toQueryString({ ...toValue(filters), pageSize: 50 })}`, {
        schema: auditLogListSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Catalog mutations invalidate every admin query: lists, counts and stats all move together. */
function useAdminMutation<TInput, TOutput>(mutationFn: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  })
}

export const useUpdateSeriesMutation = () =>
  useAdminMutation(({ id, ...body }: UpdateSeriesRequest & { id: number }) =>
    apiFetch(`/admin/series/${id}`, { method: 'PATCH', body, schema: adminSeriesDetailSchema }),
  )

export const useDeleteSeriesMutation = () =>
  useAdminMutation((id: number) =>
    apiFetch(`/admin/series/${id}`, { method: 'DELETE', schema: z.null() }),
  )

export const useMergeSeriesMutation = () =>
  useAdminMutation((body: { targetId: number; sourceIds: number[] }) =>
    apiFetch('/admin/series/merge', { method: 'POST', body, schema: idResponseSchema }),
  )

export const useSplitSeriesMutation = () =>
  useAdminMutation(({ id, mediaIds }: { id: number; mediaIds: number[] }) =>
    apiFetch(`/admin/series/${id}/split`, {
      method: 'POST',
      body: { mediaIds },
      schema: idResponseSchema,
    }),
  )

export const useCreateManualSeriesMutation = () =>
  useAdminMutation((body: CreateManualSeriesRequest) =>
    apiFetch('/admin/series', { method: 'POST', body, schema: idResponseSchema }),
  )

export const useRosterImportMutation = () =>
  useAdminMutation((body: RosterImportInput) =>
    apiFetch('/admin/rosters', { method: 'POST', body, schema: rosterImportResultSchema }),
  )

export const useUpdateCharacterMutation = () =>
  useAdminMutation(({ id, ...body }: UpdateCharacterRequest & { id: number }) =>
    apiFetch(`/admin/characters/${id}`, {
      method: 'PATCH',
      body,
      schema: adminCharacterDetailSchema,
    }),
  )

export const useCreateManualCharacterMutation = () =>
  useAdminMutation((body: Omit<CreateManualCharacterRequest, 'gender'> & { gender?: string }) =>
    apiFetch('/admin/characters', { method: 'POST', body, schema: idResponseSchema }),
  )

export const useUploadImageMutation = () =>
  useAdminMutation(
    ({ target, id, file }: { target: 'characters' | 'series'; id: number; file: File }) => {
      const form = new FormData()
      form.set('file', file)
      const path =
        target === 'characters' ? `/admin/characters/${id}/image` : `/admin/series/${id}/cover`
      return apiFetch(path, { method: 'POST', body: form, schema: imageUploadResultSchema })
    },
  )

export const useCreateImportMutation = () =>
  useAdminMutation((body: CreateImportRequest) =>
    apiFetch('/admin/imports', { method: 'POST', body, schema: importJobDtoSchema }),
  )

export const useImportActionMutation = () =>
  useAdminMutation(({ id, action }: { id: number; action: 'cancel' | 'resume' }) =>
    apiFetch(`/admin/imports/${id}/${action}`, { method: 'POST', schema: importJobDtoSchema }),
  )

// ─── Economy ─────────────────────────────────────────────────────────────────

export function useAdminSettingsQuery() {
  return useQuery({
    queryKey: adminKeys.settings,
    queryFn: () => apiFetch('/admin/settings', { schema: adminSettingsSchema }),
  })
}

export function useUpdateSettingMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: <K extends keyof AdminSettings>(input: { key: K; value: AdminSettings[K] }) =>
      apiFetch(`/admin/settings/${input.key}`, {
        method: 'PUT',
        body: input.value,
        schema: adminSettingsSchema,
      }),
    onSuccess: (settings) => {
      queryClient.setQueryData(adminKeys.settings, settings)
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit })
    },
  })
}

export function useAdminRaritiesQuery() {
  return useQuery({
    queryKey: adminKeys.rarities,
    queryFn: () => apiFetch('/admin/rarities', { schema: adminRaritiesResponseSchema }),
  })
}

export function useUpdateRarityMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { key: string; changes: UpdateRarityRequest }) =>
      apiFetch(`/admin/rarities/${input.key}`, {
        method: 'PATCH',
        body: input.changes,
        schema: updateRarityResultSchema,
      }),
    onSuccess: () => {
      for (const key of [
        adminKeys.rarities,
        adminKeys.stats,
        adminKeys.characters,
        adminKeys.audit,
      ]) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
      void queryClient.invalidateQueries({ queryKey: ['rarities'] })
    },
  })
}

export function useAdminTiersQuery() {
  return useQuery({
    queryKey: adminKeys.tiers,
    queryFn: () => apiFetch('/admin/booster-tiers', { schema: adminBoosterTiersResponseSchema }),
  })
}

export function useUpdateTierMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { key: string; changes: UpdateBoosterTierRequest }) =>
      apiFetch(`/admin/booster-tiers/${input.key}`, {
        method: 'PATCH',
        body: input.changes,
        schema: adminBoosterTiersResponseSchema,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(adminKeys.tiers, result)
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit })
      void queryClient.invalidateQueries({ queryKey: ['boosters'] })
    },
  })
}

// ─── Missions, achievements, feedback ────────────────────────────────────────

export function useAdminMissionsQuery() {
  return useQuery({
    queryKey: adminKeys.missions,
    queryFn: () => apiFetch('/admin/missions', { schema: adminMissionsResponseSchema }),
  })
}

export function useSaveMissionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      input: { id: number; changes: UpdateMissionRequest } | { create: CreateMissionRequest },
    ): Promise<void> => {
      if ('create' in input) {
        await apiFetch('/admin/missions', {
          method: 'POST',
          body: input.create,
          schema: idResponseSchema,
        })
      } else {
        await apiFetch(`/admin/missions/${input.id}`, {
          method: 'PATCH',
          body: input.changes,
          schema: adminMissionsResponseSchema,
        })
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.missions })
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit })
      void queryClient.invalidateQueries({ queryKey: ['missions'] })
    },
  })
}

export function useAdminAchievementsQuery() {
  return useQuery({
    queryKey: adminKeys.achievements,
    queryFn: () => apiFetch('/admin/achievements', { schema: adminAchievementsResponseSchema }),
  })
}

export function useSaveAchievementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      input:
        { id: number; changes: UpdateAchievementRequest } | { create: CreateAchievementRequest },
    ): Promise<void> => {
      if ('create' in input) {
        await apiFetch('/admin/achievements', {
          method: 'POST',
          body: input.create,
          schema: idResponseSchema,
        })
      } else {
        await apiFetch(`/admin/achievements/${input.id}`, {
          method: 'PATCH',
          body: input.changes,
          schema: adminAchievementsResponseSchema,
        })
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.achievements })
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit })
      void queryClient.invalidateQueries({ queryKey: ['achievements'] })
    },
  })
}

export function useAdminFeedbackQuery(page: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => [...adminKeys.feedback, toValue(page)]),
    queryFn: () =>
      apiFetch(`/admin/feedback${toQueryString({ page: toValue(page), pageSize: 20 })}`, {
        schema: adminFeedbackListSchema,
      }),
    placeholderData: keepPreviousData,
  })
}
