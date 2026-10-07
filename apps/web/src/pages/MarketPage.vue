<script setup lang="ts">
import type { ListingDto, MarketQueryInput } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useListingActionMutation,
  useMarketQuery,
  useMarketRulesQuery,
  useMyListingsQuery,
} from '@/api/social'
import { useErrorMessage } from '@/app/errors'
import { usePlayerRarities } from '@/app/rarities'
import { useSession } from '@/app/session'
import BaseDialog from '@/components/BaseDialog.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import ListingCard from '@/components/social/ListingCard.vue'
import { playerUi } from '@/components/ui'

const PAGE_SIZE = 24
const SORTS = ['recent', 'price_asc', 'price_desc', 'rarity'] as const
const { t, n } = useI18n()
const { me } = useSession()
const { rarities, nameOf } = usePlayerRarities()
const tab = ref<'browse' | 'active' | 'closed'>('browse')
const search = ref('')
const debounced = refDebounced(search, 300)
const rarity = ref('')
const wishlist = ref(false)
const missing = ref(false)
const sort = ref<(typeof SORTS)[number]>('recent')
const page = ref(1)
watch([tab, debounced, rarity, wishlist, missing, sort], () => (page.value = 1))

const browse = useMarketQuery(
  computed((): MarketQueryInput => ({
    page: page.value,
    pageSize: PAGE_SIZE,
    search: debounced.value || undefined,
    rarity: rarity.value || undefined,
    wishlist: wishlist.value ? 'true' : undefined,
    missing: missing.value ? 'true' : undefined,
    sort: sort.value,
  })),
)
const mine = useMyListingsQuery(
  computed(
    () => ({ page: page.value, status: tab.value === 'closed' ? 'closed' : 'active' }) as const,
  ),
)
const rules = useMarketRulesQuery()
const action = useListingActionMutation()
const errorMessage = useErrorMessage(action.error)
const data = computed(() => (tab.value === 'browse' ? browse.data.value : mine.data.value))
const confirming = ref<ListingDto | null>(null)
const confirmOpen = computed({
  get: () => confirming.value !== null,
  set: (value) => {
    if (!value) confirming.value = null
  },
})

async function buy(): Promise<void> {
  const listing = confirming.value
  if (!listing) return
  await action.mutateAsync({ id: listing.id, action: 'buy' }).catch(() => null)
  confirming.value = null
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('market.title') }}</h1>
          <p class="text-mist-300">{{ t('market.subtitle') }}</p>
        </div>
        <p
          v-if="me"
          class="rounded-full bg-night-800 px-4 py-2 font-semibold text-gold-400 tabular-nums"
        >
          {{ t('nav.gems', { count: n(me.gemBalance, 'integer') }) }}
        </p>
      </header>
      <div class="flex gap-1 border-b border-night-700" role="tablist">
        <button
          v-for="value in ['browse', 'active', 'closed'] as const"
          :key="value"
          type="button"
          role="tab"
          :aria-selected="tab === value"
          class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
          :class="
            tab === value
              ? 'border-sakura-400 text-mist-100'
              : 'border-transparent text-mist-300 hover:text-mist-100'
          "
          :data-testid="`market-${value}`"
          @click="tab = value"
        >
          {{ t(`market.tabs.${value}`) }}
        </button>
      </div>
      <div v-if="tab === 'browse'" class="flex flex-wrap items-center gap-3">
        <input
          v-model="search"
          type="search"
          :class="[playerUi.input, 'min-w-48 flex-1']"
          :placeholder="t('collection.searchPlaceholder')"
          :aria-label="t('collection.searchPlaceholder')"
        />
        <select v-model="rarity" :class="playerUi.select" :aria-label="t('collection.rarity')">
          <option value="">{{ t('collection.allRarities') }}</option>
          <option v-for="item in [...rarities].reverse()" :key="item.key" :value="item.key">
            {{ nameOf(item.key) }}
          </option>
        </select>
        <select v-model="sort" :class="playerUi.select" :aria-label="t('collection.sort')">
          <option v-for="value in SORTS" :key="value" :value="value">
            {{ t(`market.sorts.${value}`) }}
          </option>
        </select>
        <label class="flex items-center gap-2 text-sm text-mist-300">
          <input v-model="wishlist" type="checkbox" class="accent-sakura-500" />
          {{ t('collection.wishlistOnly') }}
        </label>
        <label class="flex items-center gap-2 text-sm text-mist-300">
          <input v-model="missing" type="checkbox" class="accent-sakura-500" />
          {{ t('market.missingOnly') }}
        </label>
      </div>
      <p v-else-if="rules.data.value" class="text-sm text-mist-300">
        {{
          t('market.usage', {
            active: rules.data.value.usage.activeListings,
            maxActive: rules.data.value.limits.maxActiveListings || '∞',
            sales: rules.data.value.usage.salesToday,
            maxSales: rules.data.value.limits.maxSalesPerDay || '∞',
          })
        }}
        {{ t('market.howToSell') }}
      </p>
      <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
      <p v-if="data && data.items.length === 0" :class="playerUi.panel">
        {{ t(`market.empty.${tab}`) }}
      </p>
      <ul v-else-if="data" :class="playerUi.cardGrid" data-testid="market-grid">
        <li v-for="listing in data.items" :key="listing.id">
          <ListingCard
            :listing="listing"
            :busy="action.isPending.value"
            @buy="confirming = listing"
            @withdraw="action.mutate({ id: listing.id, action: 'withdraw' })"
          />
        </li>
      </ul>
      <PaginationBar
        v-if="data"
        :page="page"
        :page-size="PAGE_SIZE"
        :total="data.total"
        @update:page="(value: number) => (page = value)"
      />
      <BaseDialog v-model:open="confirmOpen" :title="t('market.confirmTitle')">
        <template v-if="confirming">
          <p>
            {{
              t('market.confirmBody', {
                name: confirming.character.name,
                price: n(confirming.price, 'integer'),
                seller: confirming.seller.displayName,
              })
            }}
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl border border-night-700 px-4 py-2"
              @click="confirming = null"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-sakura-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
              :disabled="action.isPending.value"
              data-testid="confirm-buy"
              @click="buy"
            >
              {{ t('market.buyFor', { price: n(confirming.price, 'integer') }) }}
            </button>
          </div>
        </template>
      </BaseDialog>
    </RequireSignIn>
  </main>
</template>
