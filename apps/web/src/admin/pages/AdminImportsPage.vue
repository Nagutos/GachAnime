<script setup lang="ts">
import {
  IGDB_IMPORT_TOP_DEFAULT,
  IMPORT_TOP_DEFAULT,
  importSource,
  type ImportJobDto,
  type ImportSource,
} from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  useAniListSearchQuery,
  useCreateImportMutation,
  useIgdbSearchQuery,
  useImportActionMutation,
  useImportJobsQuery,
} from '@/api/admin'
import { useErrorMessage } from '../use-admin-error'
import { ui } from '../ui'

const { t, n, d } = useI18n()
const jobs = useImportJobsQuery()
const create = useCreateImportMutation()
const action = useImportActionMutation()
const errorMessage = useErrorMessage(computed(() => create.error.value ?? action.error.value))

/** AniList (anime) or IGDB (video games, ADR-025). */
const source = ref<ImportSource>('anilist')
const igdbConfigured = computed(() => jobs.data.value?.igdbConfigured ?? false)
const sourceReady = computed(() => source.value === 'anilist' || igdbConfigured.value)

const top = ref(IMPORT_TOP_DEFAULT)
const expandFranchise = ref(true)
watch(source, (value) => {
  top.value = value === 'igdb' ? IGDB_IMPORT_TOP_DEFAULT : IMPORT_TOP_DEFAULT
  selected.value = []
  search.value = ''
})
function startTop(): void {
  create.mutate(
    source.value === 'igdb'
      ? { mode: 'igdb_top', top: top.value }
      : { mode: 'top', top: top.value, expandFranchise: expandFranchise.value },
  )
}

const search = ref('')
const debouncedSearch = refDebounced(search, 400)
const anilistResults = useAniListSearchQuery(
  computed(() => (source.value === 'anilist' ? debouncedSearch.value : '')),
)
const igdbResults = useIgdbSearchQuery(
  computed(() => (source.value === 'igdb' && igdbConfigured.value ? debouncedSearch.value : '')),
)

/** Search results of the selected source, in one shape. */
const results = computed(() =>
  source.value === 'igdb'
    ? (igdbResults.data.value?.results ?? []).map((result) => ({
        id: result.igdbId,
        title: result.name,
        details: [
          result.releaseYear,
          t('admin.imports.ratings', { count: n(result.ratingCount, 'integer') }),
        ],
        coverUrl: result.coverUrl,
        importedSeriesId: result.importedSeriesId,
      }))
    : (anilistResults.data.value?.results ?? []).map((result) => ({
        id: result.anilistId,
        title: result.title,
        details: [result.titleEnglish, result.format, result.seasonYear],
        coverUrl: result.coverUrl,
        importedSeriesId: result.importedSeriesId,
      })),
)
const activeSearch = computed(() => (source.value === 'igdb' ? igdbResults : anilistResults))
const searchError = useErrorMessage(computed(() => activeSearch.value.error.value))
const selected = ref<number[]>([])
async function importSelected(): Promise<void> {
  await create.mutateAsync(
    source.value === 'igdb'
      ? { mode: 'igdb_ids', igdbIds: selected.value }
      : { mode: 'ids', anilistIds: selected.value, expandFranchise: expandFranchise.value },
  )
  selected.value = []
}

const isBusy = computed(() =>
  (jobs.data.value?.items ?? []).some((job) => job.status === 'queued' || job.status === 'running'),
)

const statusClasses: Record<ImportJobDto['status'], string> = {
  queued: 'bg-night-700 text-mist-100',
  running: 'bg-rarity-rare/20 text-rarity-rare',
  completed: 'bg-rarity-legendary/20 text-gold-400',
  failed: 'bg-rarity-mythic/20 text-rarity-mythic',
  cancelled: 'bg-night-700 text-mist-300',
}

function percent(job: ImportJobDto): number {
  const { phase, mediaTotal, mediaCharactersDone } = job.progress
  if (phase === 'done') return 1
  if (phase !== 'characters' && phase !== 'finalize') return 0
  return mediaTotal ? mediaCharactersDone / mediaTotal : 0
}

function jobLabel(job: ImportJobDto): string {
  const params = job.params
  switch (params.mode) {
    case 'top':
      return t('admin.imports.mode.top', { count: n(params.top, 'integer') })
    case 'ids':
      return t(
        'admin.imports.mode.ids',
        { count: params.anilistIds.length },
        params.anilistIds.length,
      )
    case 'igdb_top':
      return t('admin.imports.mode.igdbTop', { count: n(params.top, 'integer') })
    case 'igdb_ids':
      return t(
        'admin.imports.mode.igdbIds',
        { count: params.igdbIds.length },
        params.igdbIds.length,
      )
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="font-display text-3xl font-bold">{{ t('admin.imports.title') }}</h1>
    <div
      class="flex w-fit gap-1 rounded-xl border border-night-700 p-1"
      role="radiogroup"
      :aria-label="t('admin.imports.source')"
    >
      <button
        v-for="option in ['anilist', 'igdb'] as const"
        :key="option"
        type="button"
        role="radio"
        :aria-checked="source === option"
        class="rounded-lg px-3 py-1.5 text-sm font-semibold"
        :class="source === option ? 'bg-night-800 text-mist-100' : 'text-mist-300'"
        :data-testid="`import-source-${option}`"
        @click="source = option"
      >
        {{ t(`admin.imports.sources.${option}`) }}
      </button>
    </div>
    <p class="text-sm text-mist-300">{{ t(`admin.imports.rateNotes.${source}`) }}</p>
    <p v-if="!sourceReady" :class="ui.error" role="alert" data-testid="igdb-not-configured">
      {{ t('errors.IGDB_NOT_CONFIGURED') }}
    </p>
    <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>

    <div class="grid gap-4 lg:grid-cols-2">
      <section :class="[ui.card, 'flex flex-col gap-3']">
        <h2 class="font-display text-xl font-bold">{{ t(`admin.imports.topTitles.${source}`) }}</h2>
        <form class="flex flex-col gap-3" @submit.prevent="startTop">
          <label :class="ui.label">
            {{ t(`admin.imports.topLabels.${source}`) }}
            <input
              v-model.number="top"
              type="number"
              min="1"
              :max="source === 'igdb' ? 2000 : 5000"
              required
              :class="ui.input"
            />
          </label>
          <label v-if="source === 'anilist'" class="flex items-center gap-2 text-sm">
            <input v-model="expandFranchise" type="checkbox" class="size-4 accent-sakura-500" />
            {{ t('admin.imports.expandFranchise') }}
          </label>
          <button
            type="submit"
            :class="ui.buttonPrimary"
            :disabled="isBusy || create.isPending.value || !sourceReady"
          >
            {{ t('admin.imports.start') }}
          </button>
        </form>
      </section>

      <section :class="[ui.card, 'flex flex-col gap-3']">
        <h2 class="font-display text-xl font-bold">
          {{ t(`admin.imports.searchTitles.${source}`) }}
        </h2>
        <input
          v-model="search"
          type="search"
          :placeholder="t(`admin.imports.searchPlaceholders.${source}`)"
          :aria-label="t(`admin.imports.searchTitles.${source}`)"
          :disabled="!sourceReady"
          :class="ui.input"
        />
        <p v-if="searchError" :class="ui.error" role="alert">{{ searchError }}</p>
        <p v-else-if="activeSearch.isFetching.value" class="text-sm text-mist-300">
          {{ t('common.loading') }}
        </p>
        <p
          v-else-if="activeSearch.data.value && results.length === 0"
          class="text-sm text-mist-300"
        >
          {{ t('admin.imports.noResults') }}
        </p>
        <ul class="flex max-h-96 flex-col gap-1 overflow-y-auto">
          <li v-for="result in results" :key="result.id">
            <label class="flex cursor-pointer items-center gap-3 rounded-lg p-1 hover:bg-night-800">
              <input
                v-model="selected"
                type="checkbox"
                :value="result.id"
                :disabled="result.importedSeriesId !== null"
                class="size-4 accent-sakura-500"
              />
              <img
                v-if="result.coverUrl"
                :src="result.coverUrl"
                alt=""
                loading="lazy"
                class="h-12 w-9 rounded object-cover"
              />
              <span class="min-w-0 flex-1 text-sm">
                <span class="block truncate font-semibold">{{ result.title }}</span>
                <span class="block truncate text-xs text-mist-300">
                  {{ result.details.filter(Boolean).join(' · ') }}
                </span>
              </span>
              <RouterLink
                v-if="result.importedSeriesId !== null"
                :to="{ name: 'admin-series-detail', params: { id: result.importedSeriesId } }"
                class="text-xs text-gold-400 underline"
              >
                {{ t('admin.imports.imported') }}
              </RouterLink>
            </label>
          </li>
        </ul>
        <button
          type="button"
          :class="ui.buttonPrimary"
          :disabled="selected.length === 0 || isBusy || create.isPending.value"
          @click="importSelected"
        >
          {{ t('admin.imports.importSelected', { count: selected.length }) }}
        </button>
      </section>
    </div>

    <section class="flex flex-col gap-3">
      <h2 class="font-display text-xl font-bold">{{ t('admin.imports.jobs') }}</h2>
      <p v-if="jobs.data.value?.items.length === 0" class="text-mist-300">
        {{ t('admin.imports.noJobs') }}
      </p>
      <article
        v-for="job in jobs.data.value?.items ?? []"
        :key="job.id"
        :class="[ui.card, 'flex flex-col gap-3']"
        data-testid="import-job"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <span class="font-display text-lg font-bold">#{{ job.id }}</span>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="statusClasses[job.status]"
            >
              {{ t(`admin.imports.status.${job.status}`) }}
            </span>
            <span class="text-sm text-mist-300">{{ jobLabel(job) }}</span>
          </div>
          <div class="flex gap-2">
            <button
              v-if="job.status === 'queued' || job.status === 'running'"
              type="button"
              :class="ui.button"
              :disabled="action.isPending.value"
              @click="action.mutate({ id: job.id, action: 'cancel' })"
            >
              {{ t('admin.imports.cancel') }}
            </button>
            <button
              v-if="job.status === 'failed' || job.status === 'cancelled'"
              type="button"
              :class="ui.button"
              :disabled="action.isPending.value || isBusy"
              @click="action.mutate({ id: job.id, action: 'resume' })"
            >
              {{ t('admin.imports.resume') }}
            </button>
          </div>
        </div>
        <div v-if="job.status === 'running' || job.status === 'queued'" class="flex flex-col gap-1">
          <p class="text-sm">{{ t(`admin.imports.phase.${job.progress.phase}`) }}</p>
          <div class="h-2 overflow-hidden rounded-full bg-night-800">
            <div
              class="h-full rounded-full bg-sakura-500 transition-all"
              :style="{ width: `${percent(job) * 100}%` }"
            />
          </div>
        </div>
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist-300">
          <li>
            {{
              t(
                `admin.imports.progress.${importSource(job.params) === 'igdb' ? 'games' : 'media'}`,
                {
                  done: n(job.progress.mediaCharactersDone, 'integer'),
                  total: n(job.progress.mediaTotal, 'integer'),
                },
              )
            }}
          </li>
          <li>
            {{
              t('admin.imports.progress.characters', {
                count: n(job.progress.charactersUpserted, 'integer'),
              })
            }}
          </li>
          <li>
            {{
              t('admin.imports.progress.skipped', {
                count: n(job.progress.charactersSkippedNoImage, 'integer'),
              })
            }}
          </li>
          <li>
            {{
              t('admin.imports.progress.series', {
                count: n(job.progress.seriesCreated, 'integer'),
              })
            }}
          </li>
          <li>
            {{
              t(`admin.imports.progress.requests.${importSource(job.params)}`, {
                count: n(job.progress.requests, 'integer'),
              })
            }}
          </li>
        </ul>
        <p class="text-xs text-mist-300">
          <span v-if="job.startedAt">{{
            t('admin.imports.startedAt', { date: d(new Date(job.startedAt), 'long') })
          }}</span>
          <span v-if="job.finishedAt">
            ·
            {{ t('admin.imports.finishedAt', { date: d(new Date(job.finishedAt), 'long') }) }}</span
          >
          <span v-if="!job.requestedBy"> · {{ t('admin.imports.requestedByCli') }}</span>
        </p>
        <p v-if="job.error" :class="ui.error">{{ job.error }}</p>
      </article>
    </section>
  </div>
</template>
