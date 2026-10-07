import {
  boostersResponseSchema,
  collectionResponseSchema,
  gemHistoryResponseSchema,
  recyclePreviewSchema,
  recycleResultSchema,
  wishlistResponseSchema,
  openBoostersResponseSchema,
  raritiesResponseSchema,
  wikiCharacterListSchema,
  wikiCharacterSchema,
  wikiSeriesDetailSchema,
  wikiSeriesListSchema,
  type BoosterQuantity,
  type CollectionQueryInput,
  type OpenBoostersResponse,
  type RecycleDuplicatesRequest,
  type WikiCharactersQuery,
  type WikiSeriesQuery,
} from '@gachanime/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { notifyProgression } from '@/app/toasts'
import { meQueryKey } from './me'
import { invalidateProgression } from './progression'
import { apiFetch, toQueryString } from './client'

/** Query-string form of the collection filters (`sort` as `rarity:desc,name:asc`). */
export type CollectionFilters = CollectionQueryInput
export type WikiSeriesFilters = Partial<WikiSeriesQuery>
export type WikiCharacterFilters = Partial<WikiCharactersQuery>

export const playerKeys = {
  rarities: ['rarities'] as const,
  boosters: ['boosters'] as const,
  collection: ['collection'] as const,
  wiki: ['wiki'] as const,
  gems: ['gems'] as const,
  recyclePreview: ['recycle-preview'] as const,
}

/** After anything that changes cards or gems. */
function invalidateInventory(queryClient: ReturnType<typeof useQueryClient>): void {
  for (const key of [
    meQueryKey,
    playerKeys.boosters,
    playerKeys.collection,
    playerKeys.wiki,
    playerKeys.gems,
    playerKeys.recyclePreview,
  ]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
  invalidateProgression(queryClient)
}

export function useRaritiesQuery() {
  return useQuery({
    queryKey: playerKeys.rarities,
    queryFn: () => apiFetch('/catalog/rarities', { schema: raritiesResponseSchema }),
    staleTime: 10 * 60_000,
  })
}

export function useBoostersQuery() {
  return useQuery({
    queryKey: playerKeys.boosters,
    queryFn: () => apiFetch('/boosters', { schema: boostersResponseSchema }),
  })
}

export function useOpenBoostersMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { tier: string; quantity: BoosterQuantity }) =>
      apiFetch('/boosters/open', {
        method: 'POST',
        body: input,
        schema: openBoostersResponseSchema,
        // One key per attempt: a network retry of the same request never opens twice.
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result: OpenBoostersResponse) => {
      queryClient.setQueryData(playerKeys.boosters, (previous: unknown) => {
        const parsed = boostersResponseSchema.safeParse(previous)
        return parsed.success
          ? { ...parsed.data, free: result.free, gemBalance: result.gemBalance }
          : previous
      })
      notifyProgression(result.progression)
      invalidateInventory(queryClient)
    },
  })
}

export function useCollectionQuery(filters: MaybeRefOrGetter<CollectionFilters>) {
  return useQuery({
    queryKey: computed(() => [...playerKeys.collection, toValue(filters)]),
    queryFn: () =>
      apiFetch(`/collection${toQueryString(toValue(filters))}`, {
        schema: collectionResponseSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useWikiSeriesListQuery(filters: MaybeRefOrGetter<WikiSeriesFilters>) {
  return useQuery({
    queryKey: computed(() => [...playerKeys.wiki, 'series', toValue(filters)]),
    queryFn: () =>
      apiFetch(`/wiki/series${toQueryString(toValue(filters))}`, {
        schema: wikiSeriesListSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useWikiSeriesQuery(id: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => [...playerKeys.wiki, 'series', 'detail', toValue(id)]),
    queryFn: () => apiFetch(`/wiki/series/${toValue(id)}`, { schema: wikiSeriesDetailSchema }),
  })
}

export function useWikiSeriesCharactersQuery(
  id: MaybeRefOrGetter<number>,
  filters: MaybeRefOrGetter<WikiCharacterFilters>,
) {
  return useQuery({
    queryKey: computed(() => [
      ...playerKeys.wiki,
      'series',
      'characters',
      toValue(id),
      toValue(filters),
    ]),
    queryFn: () =>
      apiFetch(`/wiki/series/${toValue(id)}/characters${toQueryString(toValue(filters))}`, {
        schema: wikiCharacterListSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useWikiCharacterQuery(id: MaybeRefOrGetter<number>) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: computed(() => [...playerKeys.wiki, 'character', toValue(id)]),
    queryFn: async () => {
      const entry = await apiFetch(`/wiki/characters/${toValue(id)}`, {
        schema: wikiCharacterSchema,
      })
      // Reading an unlocked entry advances the daily wiki mission.
      if (!entry.locked) invalidateProgression(queryClient)
      return entry
    },
  })
}

export function useGemHistoryQuery(page: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => [...playerKeys.gems, toValue(page)]),
    queryFn: () =>
      apiFetch(`/gems${toQueryString({ page: toValue(page), pageSize: 25 })}`, {
        schema: gemHistoryResponseSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useRecycleCardsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { characterId: number; count: number }) =>
      apiFetch('/recycle', {
        method: 'POST',
        body: input,
        schema: recycleResultSchema,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result) => {
      notifyProgression(result.progression)
      invalidateInventory(queryClient)
    },
  })
}

export function useRecyclePreviewQuery(
  rarities: MaybeRefOrGetter<string[]>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery({
    queryKey: computed(() => [...playerKeys.recyclePreview, toValue(rarities)]),
    queryFn: () =>
      apiFetch(`/recycle/duplicates${toQueryString({ rarities: toValue(rarities).join(',') })}`, {
        schema: recyclePreviewSchema,
      }),
    enabled: computed(() => toValue(enabled)),
    staleTime: 0,
  })
}

export function useRecycleDuplicatesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RecycleDuplicatesRequest) =>
      apiFetch('/recycle/duplicates', {
        method: 'POST',
        body: input,
        schema: recycleResultSchema,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result) => notifyProgression(result.progression),
    onSettled: () => invalidateInventory(queryClient),
  })
}

export function useWishlistMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { characterId: number; wishlisted: boolean }) =>
      apiFetch(`/wishlist/${input.characterId}`, {
        method: input.wishlisted ? 'PUT' : 'DELETE',
        schema: wishlistResponseSchema,
      }),
    onSuccess: (result) => {
      notifyProgression(result.progression)
      void queryClient.invalidateQueries({ queryKey: playerKeys.collection })
      void queryClient.invalidateQueries({ queryKey: playerKeys.wiki })
      invalidateProgression(queryClient)
    },
  })
}
