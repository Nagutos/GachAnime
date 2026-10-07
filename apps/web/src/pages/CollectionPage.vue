<script setup lang="ts">
import { COLLECTION_SORTS, type CollectionQuery } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useCollectionQuery } from '@/api/player'
import { usePlayerRarities } from '@/app/rarities'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const PAGE_SIZE = 30

const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const { rarities, nameOf } = usePlayerRarities()

const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const rarity = ref('')
const sort = ref<CollectionQuery['sort']>('recent')
const duplicates = ref(false)
const page = ref(1)

/** Series filter comes from the URL (link from a wiki series page). */
const seriesId = computed(() => {
  const value = Number(route.query.series)
  return Number.isInteger(value) && value > 0 ? value : undefined
})
const seriesTitle = computed(() =>
  typeof route.query.seriesTitle === 'string' ? route.query.seriesTitle : null,
)

const filters = computed(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  search: debouncedSearch.value || undefined,
  rarity: rarity.value || undefined,
  sort: sort.value,
  duplicates: duplicates.value ? true : undefined,
  seriesId: seriesId.value,
}))
watch([debouncedSearch, rarity, sort, duplicates, seriesId], () => (page.value = 1))

const collection = useCollectionQuery(filters)
const data = computed(() => collection.data.value)
const hasFilters = computed(() =>
  Boolean(debouncedSearch.value || rarity.value || duplicates.value || seriesId.value),
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
        <RouterLink
          :to="{ name: 'boosters' }"
          class="rounded-xl bg-sakura-500 px-4 py-2 font-semibold text-white hover:bg-sakura-600"
        >
          {{ t('collection.openBoosters') }}
        </RouterLink>
      </header>

      <div class="flex flex-wrap items-center gap-3">
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
          <option v-for="value in COLLECTION_SORTS" :key="value" :value="value">
            {{ t(`collection.sorts.${value}`) }}
          </option>
        </select>
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
          {{ t('collection.series', { title: seriesTitle ?? `#${seriesId}` }) }}
        </button>
      </div>

      <p v-if="collection.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <div
        v-else-if="data && data.items.length === 0"
        :class="[playerUi.panel, 'flex flex-col items-center gap-3 text-center']"
      >
        <p>{{ hasFilters ? t('collection.emptyFiltered') : t('collection.empty') }}</p>
      </div>
      <ul v-else-if="data" :class="playerUi.cardGrid" data-testid="collection-grid">
        <li v-for="item in data.items" :key="item.id">
          <RouterLink
            :to="{ name: 'wiki-character', params: { id: item.id } }"
            class="block transition hover:-translate-y-1"
          >
            <CharacterCard
              :name="item.name"
              :image-url="item.imageUrl"
              :rarity-key="item.rarityKey"
              :series-title="item.series?.title"
              :quantity="item.quantity"
            />
          </RouterLink>
        </li>
      </ul>

      <PaginationBar
        v-if="data"
        :page="page"
        :page-size="PAGE_SIZE"
        :total="data.total"
        @update:page="(value: number) => (page = value)"
      />
    </RequireSignIn>
  </main>
</template>
