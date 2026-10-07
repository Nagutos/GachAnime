import {
  listingActionResultSchema,
  listingSchema,
  listingsResponseSchema,
  marketRulesSchema,
  playerCardsResponseSchema,
  playerProfileSchema,
  playersListSchema,
  tradeActionResultSchema,
  tradeSchema,
  tradesListSchema,
  type CounterTradeRequest,
  type CreateListingRequest,
  type MarketQueryInput,
  type PlayerCardsQueryInput,
  type ProposeTradeRequest,
} from '@gachanime/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { notifyProgression } from '@/app/toasts'
import { apiFetch, toQueryString } from './client'
import { meQueryKey } from './me'
import { invalidateProgression } from './progression'

export const socialKeys = {
  players: ['players'] as const,
  trades: ['trades'] as const,
  market: ['market'] as const,
}

/** Cards, gems and objectives may all change after a trade or a market action. */
function invalidateAfterExchange(queryClient: ReturnType<typeof useQueryClient>): void {
  for (const key of [
    socialKeys.players,
    socialKeys.trades,
    socialKeys.market,
    meQueryKey,
    ['collection'],
    ['wiki'],
    ['gems'],
    ['boosters'],
    ['recycle-preview'],
  ]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
  invalidateProgression(queryClient)
}

// ─── Players ─────────────────────────────────────────────────────────────────

export function usePlayersQuery(filters: MaybeRefOrGetter<{ page: number; search?: string }>) {
  return useQuery({
    queryKey: computed(() => [...socialKeys.players, 'list', toValue(filters)]),
    queryFn: () =>
      apiFetch(`/players${toQueryString({ ...toValue(filters), pageSize: 30 })}`, {
        schema: playersListSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function usePlayerProfileQuery(username: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => [...socialKeys.players, 'profile', toValue(username)]),
    queryFn: () =>
      apiFetch(`/players/${encodeURIComponent(toValue(username))}`, {
        schema: playerProfileSchema,
      }),
  })
}

export function usePlayerCardsQuery(
  username: MaybeRefOrGetter<string | null>,
  filters: MaybeRefOrGetter<PlayerCardsQueryInput>,
) {
  return useQuery({
    queryKey: computed(() => [...socialKeys.players, 'cards', toValue(username), toValue(filters)]),
    queryFn: () =>
      apiFetch(
        `/players/${encodeURIComponent(toValue(username) ?? '')}/cards${toQueryString(toValue(filters))}`,
        { schema: playerCardsResponseSchema },
      ),
    enabled: computed(() => Boolean(toValue(username))),
    placeholderData: keepPreviousData,
  })
}

// ─── Trades ──────────────────────────────────────────────────────────────────

export function useTradesQuery(
  filters: MaybeRefOrGetter<{ page: number; box: 'incoming' | 'outgoing' | 'history' }>,
) {
  return useQuery({
    queryKey: computed(() => [...socialKeys.trades, 'list', toValue(filters)]),
    queryFn: () =>
      apiFetch(`/trades${toQueryString({ ...toValue(filters), pageSize: 20 })}`, {
        schema: tradesListSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useTradeQuery(id: MaybeRefOrGetter<number | null>) {
  return useQuery({
    queryKey: computed(() => [...socialKeys.trades, 'detail', toValue(id)]),
    queryFn: () => apiFetch(`/trades/${toValue(id)}`, { schema: tradeSchema }),
    enabled: computed(() => toValue(id) !== null),
  })
}

export function useProposeTradeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      input: { propose: ProposeTradeRequest } | { counter: number; body: CounterTradeRequest },
    ) =>
      'propose' in input
        ? apiFetch('/trades', {
            method: 'POST',
            body: input.propose,
            schema: tradeSchema,
            idempotencyKey: crypto.randomUUID(),
          })
        : apiFetch(`/trades/${input.counter}/counter`, {
            method: 'POST',
            body: input.body,
            schema: tradeSchema,
          }),
    onSuccess: () => invalidateAfterExchange(queryClient),
  })
}

export function useTradeActionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: number; action: 'accept' | 'decline' | 'cancel' }) => {
      if (input.action === 'accept') {
        const result = await apiFetch(`/trades/${input.id}/accept`, {
          method: 'POST',
          schema: tradeActionResultSchema,
        })
        notifyProgression(result.progression)
        return result.trade
      }
      return apiFetch(`/trades/${input.id}/${input.action}`, {
        method: 'POST',
        schema: tradeSchema,
      })
    },
    onSettled: () => invalidateAfterExchange(queryClient),
  })
}

// ─── Market ──────────────────────────────────────────────────────────────────

export function useMarketQuery(filters: MaybeRefOrGetter<MarketQueryInput>) {
  return useQuery({
    queryKey: computed(() => [...socialKeys.market, 'browse', toValue(filters)]),
    queryFn: () =>
      apiFetch(`/market${toQueryString(toValue(filters))}`, { schema: listingsResponseSchema }),
    placeholderData: keepPreviousData,
  })
}

export function useMyListingsQuery(
  filters: MaybeRefOrGetter<{ page: number; status: 'active' | 'closed' }>,
) {
  return useQuery({
    queryKey: computed(() => [...socialKeys.market, 'mine', toValue(filters)]),
    queryFn: () =>
      apiFetch(`/market/mine${toQueryString({ ...toValue(filters), pageSize: 24 })}`, {
        schema: listingsResponseSchema,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useMarketRulesQuery() {
  return useQuery({
    queryKey: [...socialKeys.market, 'rules'],
    queryFn: () => apiFetch('/market/rules', { schema: marketRulesSchema }),
  })
}

export function useCreateListingMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateListingRequest) =>
      apiFetch('/market', {
        method: 'POST',
        body: input,
        schema: listingActionResultSchema,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result) => notifyProgression(result.progression),
    onSettled: () => invalidateAfterExchange(queryClient),
  })
}

export function useListingActionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: number; action: 'buy' | 'withdraw' }) => {
      if (input.action === 'buy') {
        const result = await apiFetch(`/market/${input.id}/buy`, {
          method: 'POST',
          schema: listingActionResultSchema,
          idempotencyKey: crypto.randomUUID(),
        })
        notifyProgression(result.progression)
        return result.listing
      }
      return apiFetch(`/market/${input.id}/withdraw`, { method: 'POST', schema: listingSchema })
    },
    onSettled: () => invalidateAfterExchange(queryClient),
  })
}
