<script setup lang="ts">
import {
  COLLECTION_OWNERSHIP,
  formatCollectionSort,
  resolveLocalizedText,
  type CollectionQueryInput,
  type CollectionSort,
} from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useBoostersQuery, useCollectionQuery } from '@/api/player'
import { usePlayerRarities } from '@/app/rarities'
import AppSelect from '@/components/AppSelect.vue'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import LockedCard from '@/components/cards/LockedCard.vue'
import CollectionTabs from '@/components/collection/CollectionTabs.vue'
import RecycleDialog from '@/components/collection/RecycleDialog.vue'
import SortEditor from '@/components/collection/SortEditor.vue'
import FavoriteButton from '@/components/collection/FavoriteButton.vue'
import WishlistButton from '@/components/collection/WishlistButton.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const PAGE_SIZE = 30

const { t, n, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { filterOptions: rarityOptions } = usePlayerRarities()

const ownership = ref<(typeof COLLECTION_OWNERSHIP)[number]>('owned')
const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const rarity = ref('')
const theme = ref('')
const boosters = useBoostersQuery()
const themes = computed(() => boosters.data.value?.themes ?? [])
const themeOptions = computed(() => [
  { value: '', label: t('collection.allPacks') },
  ...themes.value.map((item) => ({
    value: item.key,
    label: resolveLocalizedText(item.name, locale.value),
  })),
])
/** Rarest cards first by default, then by name. */
const sorts = ref<CollectionSort[]>([
  { key: 'rarity', direction: 'desc' },
  { key: 'name', direction: 'asc' },
])
const duplicates = ref(false)
const wishlist = ref(false)
const favorites = ref(false)
const page = ref(1)
const recycleOpen = ref(false)

/** Series filter comes from the URL (link from a series page). */
const seriesId = computed(() => {
  const value = Number(route.query.series)
  return Number.isInteger(value) && value > 0 ? value : undefined
})
const seriesTitle = computed(() =>
  typeof route.query.seriesTitle === 'string' ? route.query.seriesTitle : null,
)

const filters = computed((): CollectionQueryInput => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  ownership: ownership.value,
  search: debouncedSearch.value || undefined,
  rarity: rarity.value || undefined,
  sort: formatCollectionSort(sorts.value),
  duplicates: duplicates.value ? 'true' : undefined,
  wishlist: wishlist.value ? 'true' : undefined,
  favorites: favorites.value ? 'true' : undefined,
  seriesId: seriesId.value,
}))
watch(
  [ownership, debouncedSearch, rarity, theme, sorts, duplicates, wishlist, favorites, seriesId],
  () => {
    page.value = 1
  },
)

const collection = useCollectionQuery(filters)
const data = computed(() => collection.data.value)
const hasFilters = computed(() =>
  Boolean(
    debouncedSearch.value ||
    rarity.value ||
    theme.value ||
    duplicates.value ||
    wishlist.value ||
    favorites.value ||
    seriesId.value,
  ),
)

function clearSeries(): void {
  void router.replace({ query: {} })
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('collection.title') }}</h1>
          <p v-if="data" class="text-mist-300" data-testid="collection-summary">
            {{
              t('collection.summary', {
                owned: n(data.summary.owned, 'integer'),
                catalog: n(data.summary.catalog, 'integer'),
                cards: n(data.summary.cards, 'integer'),
              })
            }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl border border-night-700 bg-night-800 px-4 py-2 font-semibold hover:bg-night-700"
            data-testid="open-recycle"
            @click="recycleOpen = true"
          >
            {{ t('recycle.open') }}
          </button>
          <RouterLink
            :to="{ name: 'boosters' }"
            class="rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700"
          >
            {{ t('collection.openBoosters') }}
          </RouterLink>
        </div>
      </header>

      <CollectionTabs />

      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex rounded-lg border border-night-700 p-0.5" role="group">
            <button
              v-for="value in COLLECTION_OWNERSHIP"
              :key="value"
              type="button"
              class="rounded-md px-3 py-1.5 text-sm"
              :class="
                ownership === value
                  ? 'bg-night-700 font-semibold text-mist-100'
                  : 'text-mist-300 hover:text-mist-100'
              "
              :aria-pressed="ownership === value"
              :data-testid="`ownership-${value}`"
              @click="ownership = value"
            >
              {{ t(`collection.ownership.${value}`) }}
            </button>
          </div>
          <input
            v-model="search"
            type="search"
            :class="[playerUi.input, 'min-w-48 flex-1']"
            :placeholder="t('collection.searchPlaceholder')"
            :aria-label="t('collection.searchPlaceholder')"
          />
          <AppSelect
            v-model="rarity"
            :options="rarityOptions"
            :aria-label="t('collection.rarity')"
          />
          <AppSelect
            v-if="themes.length"
            v-model="theme"
            :options="themeOptions"
            :aria-label="t('collection.pack')"
          />
        </div>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
          <SortEditor v-model="sorts" />
          <label class="flex items-center gap-2 text-sm text-mist-300">
            <input v-model="wishlist" type="checkbox" class="accent-sakura-500" />
            {{ t('collection.wishlistOnly') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-mist-300">
            <input
              v-model="favorites"
              type="checkbox"
              class="accent-sakura-500"
              data-testid="filter-favorites"
            />
            {{ t('collection.favoritesOnly') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-mist-300">
            <input v-model="duplicates" type="checkbox" class="accent-sakura-500" />
            {{ t('collection.duplicates') }}
          </label>
          <button
            v-if="seriesId"
            type="button"
            class="rounded-full border border-sakura-400/60 px-3 py-1 text-sm text-sakura-400 hover:bg-sakura-400/10"
            @click="clearSeries"
          >
            {{ t('collection.series', { title: seriesTitle ?? String(seriesId) }) }}
          </button>
        </div>
      </div>

      <p v-if="collection.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <div
        v-else-if="data && data.items.length === 0"
        :class="[playerUi.panel, 'flex flex-col items-center gap-3 text-center']"
      >
        <p>{{ hasFilters ? t('collection.emptyFiltered') : t('collection.empty') }}</p>
      </div>
      <ul v-else-if="data" :class="playerUi.cardGrid" data-testid="collection-grid">
        <li v-for="item in data.items" :key="item.id" class="relative">
          <LockedCard
            v-if="item.locked"
            :to="{ name: 'wiki-character', params: { id: item.id } }"
            :name="item.name"
            :image-url="item.imageUrl"
            :rarity-key="item.rarityKey"
            :series="item.series"
            class="transition hover:-translate-y-1"
          />
          <CharacterCard
            v-else
            :to="{ name: 'wiki-character', params: { id: item.id } }"
            :name="item.name"
            :image-url="item.imageUrl"
            :rarity-key="item.rarityKey"
            :series="item.series"
            :quantity="item.quantity"
            class="transition hover:-translate-y-1"
            :class="{ 'opacity-60 grayscale': item.quantity === 0 }"
          />
          <div class="absolute right-1.5 bottom-12 flex flex-col gap-1">
            <FavoriteButton v-if="!item.locked" :character-id="item.id" :favorite="item.favorite" />
            <WishlistButton :character-id="item.id" :wishlisted="item.wishlisted" />
          </div>
        </li>
      </ul>

      <PaginationBar
        v-if="data"
        :page="page"
        :page-size="PAGE_SIZE"
        :total="data.total"
        @update:page="(value: number) => (page = value)"
      />
      <RecycleDialog v-model:open="recycleOpen" />
    </RequireSignIn>
  </main>
</template>
