import {
  adminCharacterDetailSchema,
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
  type UpdateCharacterRequest,
  type UpdateSeriesRequest,
} from '@gachanime/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { z } from 'zod'
import { apiFetch } from './client'

/** `{ a: 1, b: undefined }` → `?a=1` */
function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

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
