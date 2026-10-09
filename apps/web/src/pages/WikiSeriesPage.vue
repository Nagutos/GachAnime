<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useWikiSeriesCharactersQuery, useWikiSeriesQuery } from '@/api/player'
import { useErrorMessage } from '@/app/errors'
import BackLink from '@/components/BackLink.vue'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import LockedCard from '@/components/cards/LockedCard.vue'
import WishlistButton from '@/components/collection/WishlistButton.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'
import DescriptionText from '@/components/wiki/DescriptionText.vue'
import SeriesProgress from '@/components/wiki/SeriesProgress.vue'

const PAGE_SIZE = 36
const FILTERS = ['all', 'unlocked', 'locked'] as const

const props = defineProps<{ id: number }>()
const { t } = useI18n()

const filter = ref<(typeof FILTERS)[number]>('all')
const page = ref(1)
watch([filter, () => props.id], () => (page.value = 1))

const detail = useWikiSeriesQuery(() => props.id)
const entries = useWikiSeriesCharactersQuery(
  () => props.id,
  computed(() => ({
    page: page.value,
    pageSize: PAGE_SIZE,
    unlocked: filter.value === 'all' ? undefined : filter.value === 'unlocked',
  })),
)
const errorMessage = useErrorMessage(detail.error)
const series = computed(() => detail.data.value)
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <BackLink :to="{ name: 'wiki' }" :label="t('wiki.back')" />

      <p v-if="detail.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
      <template v-else-if="series">
        <header :class="[playerUi.panel, 'flex flex-col gap-5 sm:flex-row']">
          <img
            v-if="series.coverUrl"
            :src="series.coverUrl"
            alt=""
            referrerpolicy="no-referrer"
            class="aspect-5/7 w-32 shrink-0 self-start rounded-xl object-cover"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <h1 :class="playerUi.title" data-testid="series-title">{{ series.title }}</h1>
              <p
                v-if="series.titleEnglish && series.titleEnglish !== series.title"
                class="text-mist-300"
              >
                {{ series.titleEnglish }}
              </p>
            </div>
            <ul v-if="series.genres.length" class="flex flex-wrap gap-1.5">
              <li
                v-for="genre in series.genres"
                :key="genre"
                class="rounded-full bg-night-800 px-2 py-0.5 text-xs text-mist-300"
              >
                {{ genre }}
              </li>
            </ul>
            <SeriesProgress
              class="max-w-sm"
              :owned="series.ownedCount"
              :unlocked="series.unlockedCount"
              :total="series.characterCount"
            />
            <details v-if="series.description" class="text-sm">
              <summary class="cursor-pointer text-mist-300 hover:text-mist-100">
                {{ t('wiki.about') }}
              </summary>
              <DescriptionText class="mt-2" :text="series.description" />
            </details>
            <div class="flex flex-wrap items-center gap-3 text-sm">
              <RouterLink
                v-if="series.ownedCount > 0"
                :to="{
                  name: 'collection',
                  query: { series: series.id, seriesTitle: series.title },
                }"
                class="text-gold-400 underline"
              >
                {{ t('wiki.myCards') }}
              </RouterLink>
              <a
                v-if="series.siteUrl"
                :href="series.siteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-mist-300 hover:text-sakura-400"
              >
                {{ t(`wiki.credits.${series.source}`) }}
              </a>
            </div>
          </div>
        </header>

        <div class="flex gap-2" role="group" :aria-label="t('wiki.filterLabel')">
          <button
            v-for="value in FILTERS"
            :key="value"
            type="button"
            class="rounded-full border px-3 py-1 text-sm"
            :class="
              filter === value
                ? 'border-sakura-400 bg-sakura-400/10 text-sakura-400'
                : 'border-night-700 text-mist-300 hover:bg-night-800'
            "
            :aria-pressed="filter === value"
            @click="filter = value"
          >
            {{ t(`wiki.filters.${value}`) }}
          </button>
        </div>

        <ul v-if="entries.data.value" :class="playerUi.cardGrid" data-testid="wiki-entries">
          <li v-for="entry in entries.data.value.items" :key="entry.id" class="relative">
            <LockedCard
              v-if="entry.locked"
              :to="{ name: 'wiki-character', params: { id: entry.id } }"
              :name="entry.name"
              :image-url="entry.imageUrl"
              :rarity-key="entry.rarityKey"
              class="transition hover:-translate-y-1"
            />
            <CharacterCard
              v-else
              :to="{ name: 'wiki-character', params: { id: entry.id } }"
              :name="entry.name"
              :image-url="entry.imageUrl"
              :rarity-key="entry.rarityKey"
              :quantity="entry.quantity"
              class="transition hover:-translate-y-1"
              :class="{ 'opacity-60 grayscale': entry.quantity === 0 }"
            />
            <WishlistButton
              class="absolute right-1.5 bottom-12"
              :character-id="entry.id"
              :wishlisted="entry.wishlisted"
            />
          </li>
        </ul>
        <PaginationBar
          v-if="entries.data.value"
          :page="page"
          :page-size="PAGE_SIZE"
          :total="entries.data.value.total"
          @update:page="(value: number) => (page = value)"
        />
      </template>
    </RequireSignIn>
  </main>
</template>
