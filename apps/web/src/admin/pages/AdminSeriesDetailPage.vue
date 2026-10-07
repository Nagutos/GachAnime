<script setup lang="ts">
import type { AdminCharacter } from '@gachanime/shared'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import {
  useCharacterListQuery,
  useSeriesDetailQuery,
  useSplitSeriesMutation,
  useUpdateSeriesMutation,
} from '@/api/admin'
import AdminPagination from '../components/AdminPagination.vue'
import CharacterFormDialog from '../components/CharacterFormDialog.vue'
import CharacterTable from '../components/CharacterTable.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ImageUploadButton from '../components/ImageUploadButton.vue'
import RarityBadge from '../components/RarityBadge.vue'
import SeriesFormDialog from '../components/SeriesFormDialog.vue'
import { plainText } from '../text'
import { useErrorMessage } from '../use-admin-error'
import { useRarities } from '../use-rarities'
import { ui } from '../ui'

const props = defineProps<{ id: number }>()
const { t, n, d } = useI18n()
const router = useRouter()
const { rarities } = useRarities()
const detail = useSeriesDetailQuery(() => props.id)
const series = computed(() => detail.data.value)
const detailError = useErrorMessage(detail.error)

const PAGE_SIZE = 50
const page = ref(1)
const characters = useCharacterListQuery(() => ({
  seriesId: props.id,
  page: page.value,
  pageSize: PAGE_SIZE,
}))

const update = useUpdateSeriesMutation()
const split = useSplitSeriesMutation()
const errorMessage = useErrorMessage(computed(() => update.error.value ?? split.error.value))

const selectedMedia = ref<number[]>([])
const splitOpen = ref(false)
async function confirmSplit(): Promise<void> {
  const { id } = await split.mutateAsync({ id: props.id, mediaIds: selectedMedia.value })
  selectedMedia.value = []
  splitOpen.value = false
  await router.push({ name: 'admin-series-detail', params: { id } })
}

const editOpen = ref(false)
const characterFormOpen = ref(false)
const editedCharacter = ref<AdminCharacter | null>(null)
function openCharacterForm(character: AdminCharacter | null): void {
  editedCharacter.value = character
  characterFormOpen.value = true
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <RouterLink :to="{ name: 'admin-series' }" class="text-sm text-mist-300 hover:text-sakura-400">
      {{ t('admin.seriesDetail.back') }}
    </RouterLink>
    <p v-if="detailError" :class="ui.error" role="alert">{{ detailError }}</p>
    <p v-else-if="!series" class="text-mist-300">{{ t('common.loading') }}</p>
    <template v-else>
      <section class="flex flex-col gap-4 sm:flex-row">
        <img
          v-if="series.coverUrl"
          :src="series.coverUrl"
          alt=""
          class="h-60 w-44 shrink-0 rounded-xl object-cover shadow-lg"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <h1 class="font-display text-3xl font-bold" data-testid="series-title">
              {{ series.title }}
            </h1>
            <p v-if="series.titleEnglish" class="text-mist-300">{{ series.titleEnglish }}</p>
          </div>
          <p class="flex flex-wrap gap-2 text-xs">
            <span class="rounded-full bg-night-800 px-2 py-1">{{
              t(`admin.kinds.${series.kind}`)
            }}</span>
            <span class="rounded-full bg-night-800 px-2 py-1">{{
              t(`admin.sources.${series.source}`)
            }}</span>
            <span class="rounded-full bg-night-800 px-2 py-1">
              {{ t('admin.seriesDetail.slug') }} · {{ series.slug }}
            </span>
            <span
              v-for="genre in series.genres"
              :key="genre"
              class="rounded-full bg-night-800 px-2 py-1"
            >
              {{ genre }}
            </span>
          </p>
          <p class="line-clamp-4 text-sm whitespace-pre-line text-mist-300">
            {{ plainText(series.description) || t('admin.seriesDetail.noDescription') }}
          </p>
          <ul class="flex flex-wrap gap-3 text-sm">
            <li v-for="rarity in rarities" :key="rarity.key" class="tabular-nums">
              <RarityBadge :rarity="rarity.key" />
              {{ n(series.rarityCounts[rarity.key] ?? 0, 'integer') }}
            </li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="ui.button"
              :disabled="update.isPending.value"
              @click="update.mutate({ id: series.id, isActive: !series.isActive })"
            >
              {{ series.isActive ? t('admin.series.deactivate') : t('admin.series.activate') }}
            </button>
            <template v-if="series.source === 'manual'">
              <button type="button" :class="ui.button" @click="editOpen = true">
                {{ t('admin.seriesDetail.edit') }}
              </button>
              <ImageUploadButton
                :id="series.id"
                target="series"
                :label="t('admin.seriesDetail.uploadCover')"
              />
              <button type="button" :class="ui.buttonPrimary" @click="openCharacterForm(null)">
                {{ t('admin.seriesDetail.addCharacter') }}
              </button>
            </template>
          </div>
          <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
        </div>
      </section>

      <section v-if="series.media.length > 0" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-display text-xl font-bold">{{ t('admin.seriesDetail.media') }}</h2>
          <button
            type="button"
            :class="ui.button"
            :disabled="selectedMedia.length === 0 || selectedMedia.length === series.media.length"
            @click="splitOpen = true"
          >
            {{ t('admin.seriesDetail.split') }}
          </button>
        </div>
        <p class="text-sm text-mist-300">{{ t('admin.seriesDetail.splitHelp') }}</p>
        <div class="overflow-x-auto rounded-2xl border border-night-700">
          <table :class="ui.table">
            <thead class="bg-night-900">
              <tr>
                <th :class="ui.th">
                  <span class="sr-only">{{ t('admin.seriesDetail.split') }}</span>
                </th>
                <th :class="ui.th">{{ t('admin.series.columns.title') }}</th>
                <th :class="ui.th">{{ t('admin.seriesDetail.format') }}</th>
                <th :class="ui.th">{{ t('admin.seriesDetail.year') }}</th>
                <th :class="[ui.th, 'text-right']">{{ t('admin.series.columns.characters') }}</th>
                <th :class="[ui.th, 'text-right']">{{ t('admin.series.columns.popularity') }}</th>
                <th :class="ui.th">{{ t('admin.seriesDetail.syncedAt') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in series.media" :key="item.id" class="border-t border-night-800">
                <td :class="ui.td">
                  <input
                    v-model="selectedMedia"
                    type="checkbox"
                    :value="item.id"
                    :aria-label="t('admin.series.select', { title: item.titleRomaji })"
                    class="size-4 accent-sakura-500"
                  />
                </td>
                <td :class="ui.td">
                  <a
                    :href="item.siteUrl ?? `https://anilist.co/anime/${item.anilistId}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-3 hover:text-sakura-400"
                    :title="t('admin.common.openOnAniList')"
                  >
                    <img
                      v-if="item.coverUrl"
                      :src="item.coverUrl"
                      alt=""
                      loading="lazy"
                      class="h-12 w-9 rounded object-cover"
                    />
                    <span>
                      {{ item.titleRomaji }}
                      <span v-if="item.titleEnglish" class="block text-xs text-mist-300">{{
                        item.titleEnglish
                      }}</span>
                    </span>
                  </a>
                </td>
                <td :class="ui.td">{{ item.format ?? '-' }}</td>
                <td :class="[ui.td, 'tabular-nums']">{{ item.seasonYear ?? '-' }}</td>
                <td :class="[ui.td, 'text-right tabular-nums']">
                  {{ n(item.characterCount, 'integer') }}
                </td>
                <td :class="[ui.td, 'text-right tabular-nums']">
                  {{ n(item.popularity, 'integer') }}
                </td>
                <td :class="[ui.td, 'text-xs text-mist-300']">
                  {{
                    item.charactersSyncedAt
                      ? d(new Date(item.charactersSyncedAt), 'long')
                      : t('admin.seriesDetail.notSynced')
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="font-display text-xl font-bold">{{ t('admin.seriesDetail.characters') }}</h2>
        <CharacterTable :items="characters.data.value?.items ?? []" @edit="openCharacterForm" />
        <AdminPagination
          v-if="characters.data.value"
          v-model:page="page"
          :page-size="PAGE_SIZE"
          :total="characters.data.value.total"
        />
      </section>

      <ConfirmDialog
        v-model:open="splitOpen"
        :title="t('admin.seriesDetail.split')"
        :description="t('admin.seriesDetail.splitConfirm', { count: selectedMedia.length })"
        :pending="split.isPending.value"
        @confirm="confirmSplit"
      />
      <SeriesFormDialog v-model:open="editOpen" :series="series" />
      <CharacterFormDialog
        v-model:open="characterFormOpen"
        :series-id="series.id"
        :character="editedCharacter"
      />
    </template>
  </div>
</template>
