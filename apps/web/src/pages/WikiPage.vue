<script setup lang="ts">
import type { WikiSeriesQuery } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWikiSeriesListQuery } from '@/api/player'
import AppSelect from '@/components/AppSelect.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'
import SeriesTile from '@/components/wiki/SeriesTile.vue'

const PAGE_SIZE = 24
const SORTS: WikiSeriesQuery['sort'][] = ['popularity', 'title', 'progress']

const { t } = useI18n()
const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const sort = ref<WikiSeriesQuery['sort']>('popularity')
const page = ref(1)
watch([debouncedSearch, sort], () => (page.value = 1))

const list = useWikiSeriesListQuery(
  computed(() => ({
    page: page.value,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.value || undefined,
    sort: sort.value,
  })),
)
const data = computed(() => list.data.value)
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header>
        <h1 :class="playerUi.title">{{ t('wiki.title') }}</h1>
        <p class="text-mist-300">{{ t('wiki.subtitle') }}</p>
      </header>

      <div class="flex flex-wrap gap-3">
        <input
          v-model="search"
          type="search"
          :class="[playerUi.input, 'min-w-48 flex-1']"
          :placeholder="t('wiki.searchPlaceholder')"
          :aria-label="t('wiki.searchPlaceholder')"
        />
        <AppSelect
          v-model="sort"
          :options="SORTS.map((value) => ({ value, label: t(`wiki.sorts.${value}`) }))"
          :aria-label="t('wiki.sort')"
        />
      </div>

      <p v-if="list.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="data && data.items.length === 0" :class="playerUi.panel">
        {{ t('wiki.empty') }}
      </p>
      <ul
        v-else-if="data"
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        data-testid="wiki-series-grid"
      >
        <li v-for="item in data.items" :key="item.id">
          <SeriesTile :series="item" />
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
