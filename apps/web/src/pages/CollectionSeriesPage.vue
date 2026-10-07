<script setup lang="ts">
import type { WikiSeriesQuery } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWikiSeriesListQuery } from '@/api/player'
import CollectionTabs from '@/components/collection/CollectionTabs.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'
import SeriesTile from '@/components/wiki/SeriesTile.vue'

const PAGE_SIZE = 24
const STATUSES = ['started', 'incomplete', 'complete', 'all'] as const
const SORTS: WikiSeriesQuery['sort'][] = ['progress', 'popularity', 'title']

const { t } = useI18n()
const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const status = ref<(typeof STATUSES)[number]>('started')
const sort = ref<WikiSeriesQuery['sort']>('progress')
const page = ref(1)
watch([debouncedSearch, status, sort], () => (page.value = 1))

const list = useWikiSeriesListQuery(
  computed(() => ({
    page: page.value,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.value || undefined,
    sort: sort.value,
    status: status.value === 'all' ? undefined : status.value,
  })),
)
const data = computed(() => list.data.value)
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header>
        <h1 :class="playerUi.title">{{ t('collection.title') }}</h1>
        <p class="text-mist-300">{{ t('collection.seriesSubtitle') }}</p>
      </header>
      <CollectionTabs />

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex rounded-lg border border-night-700 p-0.5" role="group">
          <button
            v-for="value in STATUSES"
            :key="value"
            type="button"
            class="rounded-md px-3 py-1.5 text-sm"
            :class="
              status === value
                ? 'bg-night-700 font-semibold text-mist-100'
                : 'text-mist-300 hover:text-mist-100'
            "
            :aria-pressed="status === value"
            @click="status = value"
          >
            {{ t(`collection.seriesStatus.${value}`) }}
          </button>
        </div>
        <input
          v-model="search"
          type="search"
          :class="[playerUi.input, 'min-w-48 flex-1']"
          :placeholder="t('wiki.searchPlaceholder')"
          :aria-label="t('wiki.searchPlaceholder')"
        />
        <select v-model="sort" :class="playerUi.select" :aria-label="t('wiki.sort')">
          <option v-for="value in SORTS" :key="value" :value="value">
            {{ t(`wiki.sorts.${value}`) }}
          </option>
        </select>
      </div>

      <p v-if="list.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="data && data.items.length === 0" :class="playerUi.panel">
        {{ t('collection.noSeries') }}
      </p>
      <ul v-else-if="data" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li v-for="item in data.items" :key="item.id"><SeriesTile :series="item" /></li>
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
