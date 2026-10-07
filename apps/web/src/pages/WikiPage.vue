<script setup lang="ts">
import type { WikiSeriesQuery } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useWikiSeriesListQuery } from '@/api/player'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'
import SeriesProgress from '@/components/wiki/SeriesProgress.vue'

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
        <select v-model="sort" :class="playerUi.select" :aria-label="t('wiki.sort')">
          <option v-for="value in SORTS" :key="value" :value="value">
            {{ t(`wiki.sorts.${value}`) }}
          </option>
        </select>
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
          <RouterLink
            :to="{ name: 'wiki-series', params: { id: item.id } }"
            class="group flex h-full flex-col overflow-hidden rounded-2xl border border-night-700 bg-night-900/70 transition hover:-translate-y-1 hover:border-sakura-400/60"
          >
            <div class="relative aspect-16/9 overflow-hidden bg-night-800">
              <img
                v-if="item.coverUrl"
                :src="item.coverUrl"
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
                class="size-full object-cover opacity-80 transition group-hover:opacity-100"
              />
            </div>
            <div class="flex flex-1 flex-col gap-2 p-3">
              <p class="line-clamp-2 leading-tight font-semibold">{{ item.title }}</p>
              <SeriesProgress
                class="mt-auto"
                :owned="item.ownedCount"
                :unlocked="item.unlockedCount"
                :total="item.characterCount"
              />
            </div>
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
