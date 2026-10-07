import {
  boostersResponseSchema,
  collectionResponseSchema,
  openBoostersResponseSchema,
  raritiesResponseSchema,
  wikiCharacterListSchema,
  wikiCharacterSchema,
  wikiSeriesDetailSchema,
  wikiSeriesListSchema,
  type BoosterQuantity,
  type CollectionQuery,
  type OpenBoostersResponse,
  type WikiCharactersQuery,
  type WikiSeriesQuery,
} from '@gachanime/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { apiFetch, toQueryString } from './client'

export type CollectionFilters = Partial<CollectionQuery>
export type WikiSeriesFilters = Partial<WikiSeriesQuery>
export type WikiCharacterFilters = Partial<WikiCharactersQuery>

export const playerKeys = {
  rarities: ['rarities'] as const,
  boosters: ['boosters'] as const,
  collection: ['collection'] as const,
  wiki: ['wiki'] as const,
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
        return parsed.success ? { ...parsed.data, free: result.free } : previous
      })
      void queryClient.invalidateQueries({ queryKey: playerKeys.collection })
      void queryClient.invalidateQueries({ queryKey: playerKeys.wiki })
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
  return useQuery({
    queryKey: computed(() => [...playerKeys.wiki, 'character', toValue(id)]),
    queryFn: () => apiFetch(`/wiki/characters/${toValue(id)}`, { schema: wikiCharacterSchema }),
  })
}
