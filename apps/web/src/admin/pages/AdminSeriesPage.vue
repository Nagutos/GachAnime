<script setup lang="ts">
import type { AdminSeriesItem, CatalogSource, SeriesKind } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  useDeleteSeriesMutation,
  useMergeSeriesMutation,
  useSeriesListQuery,
  useUpdateSeriesMutation,
} from '@/api/admin'
import AdminDialog from '../components/AdminDialog.vue'
import AdminPagination from '../components/AdminPagination.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import RosterImportDialog from '../components/RosterImportDialog.vue'
import SeriesFormDialog from '../components/SeriesFormDialog.vue'
import { useErrorMessage } from '../use-admin-error'
import { ui } from '../ui'

const { t, n } = useI18n()
const PAGE_SIZE = 50
const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const kind = ref<SeriesKind | ''>('')
const source = ref<CatalogSource | ''>('')
const status = ref<'' | 'true' | 'false'>('')
const page = ref(1)
watch([debouncedSearch, kind, source, status], () => (page.value = 1))

const filters = computed(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  search: debouncedSearch.value || undefined,
  kind: kind.value || undefined,
  source: source.value || undefined,
  active: status.value === '' ? undefined : status.value === 'true',
}))
const list = useSeriesListQuery(filters)
const items = computed(() => list.data.value?.items ?? [])

const update = useUpdateSeriesMutation()
const remove = useDeleteSeriesMutation()
const merge = useMergeSeriesMutation()
const mutationError = computed(() => update.error.value ?? remove.error.value ?? merge.error.value)
const errorMessage = useErrorMessage(mutationError)

// Selection for merging (kept across pages).
const selected = ref(new Map<number, AdminSeriesItem>())
function toggle(item: AdminSeriesItem): void {
  if (selected.value.has(item.id)) selected.value.delete(item.id)
  else selected.value.set(item.id, item)
}
const mergeOpen = ref(false)
const mergeTarget = ref<number | null>(null)
function openMerge(): void {
  mergeTarget.value = [...selected.value.keys()][0] ?? null
  mergeOpen.value = true
}
async function confirmMerge(): Promise<void> {
  if (mergeTarget.value === null) return
  const sourceIds = [...selected.value.keys()].filter((id) => id !== mergeTarget.value)
  await merge.mutateAsync({ targetId: mergeTarget.value, sourceIds })
  selected.value.clear()
  mergeOpen.value = false
}

const toDelete = ref<AdminSeriesItem | null>(null)
const deleteOpen = computed({
  get: () => toDelete.value !== null,
  set: (value) => {
    if (!value) toDelete.value = null
  },
})
async function confirmDelete(): Promise<void> {
  if (!toDelete.value) return
  await remove.mutateAsync(toDelete.value.id)
  selected.value.delete(toDelete.value.id)
  toDelete.value = null
}

const createOpen = ref(false)
const rosterOpen = ref(false)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="font-display text-3xl font-bold">{{ t('admin.series.title') }}</h1>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="ui.button" @click="rosterOpen = true">
          {{ t('admin.series.importRoster') }}
        </button>
        <button type="button" :class="ui.buttonPrimary" @click="createOpen = true">
          {{ t('admin.series.newManual') }}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <label :class="[ui.label, 'min-w-56 flex-1']">
        {{ t('admin.common.search') }}
        <input
          v-model="search"
          type="search"
          :placeholder="t('admin.series.searchPlaceholder')"
          :class="ui.input"
        />
      </label>
      <label :class="ui.label">
        {{ t('admin.series.kind') }}
        <select v-model="kind" :class="ui.select">
          <option value="">{{ t('admin.common.all') }}</option>
          <option v-for="value in ['anime', 'game', 'other'] as const" :key="value" :value="value">
            {{ t(`admin.kinds.${value}`) }}
          </option>
        </select>
      </label>
      <label :class="ui.label">
        {{ t('admin.series.source') }}
        <select v-model="source" :class="ui.select">
          <option value="">{{ t('admin.common.all') }}</option>
          <option v-for="value in ['anilist', 'manual'] as const" :key="value" :value="value">
            {{ t(`admin.sources.${value}`) }}
          </option>
        </select>
      </label>
      <label :class="ui.label">
        {{ t('admin.series.status') }}
        <select v-model="status" :class="ui.select">
          <option value="">{{ t('admin.common.all') }}</option>
          <option value="true">{{ t('admin.common.active') }}</option>
          <option value="false">{{ t('admin.common.inactive') }}</option>
        </select>
      </label>
    </div>

    <div
      v-if="selected.size > 0"
      class="flex items-center gap-3 rounded-xl bg-night-800 px-4 py-2 text-sm"
    >
      <span>{{ t('admin.series.selected', { count: selected.size }, selected.size) }}</span>
      <button
        type="button"
        :class="ui.buttonPrimary"
        :disabled="selected.size < 2"
        @click="openMerge"
      >
        {{ t('admin.series.merge') }}
      </button>
    </div>
    <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>

    <div class="overflow-x-auto rounded-2xl border border-night-700">
      <table :class="ui.table">
        <thead class="bg-night-900">
          <tr>
            <th :class="ui.th">
              <span class="sr-only">{{ t('admin.series.merge') }}</span>
            </th>
            <th :class="ui.th">{{ t('admin.series.columns.title') }}</th>
            <th :class="ui.th">{{ t('admin.series.columns.kind') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.series.columns.media') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.series.columns.characters') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.series.columns.popularity') }}</th>
            <th :class="ui.th">{{ t('admin.series.columns.status') }}</th>
            <th :class="ui.th">
              <span class="sr-only">{{ t('admin.common.delete') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="border-t border-night-800"
            :class="{ 'opacity-50': !item.isActive }"
            data-testid="series-row"
          >
            <td :class="ui.td">
              <input
                type="checkbox"
                :checked="selected.has(item.id)"
                :aria-label="t('admin.series.select', { title: item.title })"
                class="size-4 accent-sakura-500"
                @change="toggle(item)"
              />
            </td>
            <td :class="ui.td">
              <RouterLink
                :to="{ name: 'admin-series-detail', params: { id: item.id } }"
                class="flex items-center gap-3 hover:text-sakura-400"
              >
                <img
                  v-if="item.coverUrl"
                  :src="item.coverUrl"
                  alt=""
                  loading="lazy"
                  class="h-12 w-9 rounded object-cover"
                />
                <span>
                  <span class="font-semibold">{{ item.title }}</span>
                  <span v-if="item.titleEnglish" class="block text-xs text-mist-300">{{
                    item.titleEnglish
                  }}</span>
                </span>
              </RouterLink>
            </td>
            <td :class="ui.td">
              {{ t(`admin.kinds.${item.kind}`) }}
              <span class="block text-xs text-mist-300">{{
                t(`admin.sources.${item.source}`)
              }}</span>
            </td>
            <td :class="[ui.td, 'text-right tabular-nums']">{{ n(item.mediaCount, 'integer') }}</td>
            <td :class="[ui.td, 'text-right tabular-nums']">
              {{ n(item.characterCount, 'integer') }}
            </td>
            <td :class="[ui.td, 'text-right tabular-nums']">{{ n(item.popularity, 'integer') }}</td>
            <td :class="ui.td">
              <button
                type="button"
                :class="ui.button"
                :disabled="update.isPending.value"
                @click="update.mutate({ id: item.id, isActive: !item.isActive })"
              >
                {{ item.isActive ? t('admin.series.deactivate') : t('admin.series.activate') }}
              </button>
            </td>
            <td :class="ui.td">
              <button
                type="button"
                class="text-sm text-rarity-mythic hover:underline"
                @click="toDelete = item"
              >
                {{ t('admin.common.delete') }}
              </button>
            </td>
          </tr>
          <tr v-if="!list.isPending.value && items.length === 0">
            <td colspan="8" :class="[ui.td, 'py-8 text-center text-mist-300']">
              {{ t('admin.common.empty') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination
      v-if="list.data.value"
      v-model:page="page"
      :page-size="PAGE_SIZE"
      :total="list.data.value.total"
    />

    <AdminDialog
      v-model:open="mergeOpen"
      :title="t('admin.series.mergeTitle')"
      :description="t('admin.series.mergeHelp')"
    >
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 text-sm text-mist-300">{{ t('admin.series.mergeTarget') }}</legend>
        <label
          v-for="item in selected.values()"
          :key="item.id"
          class="flex items-center gap-2 text-sm"
        >
          <input
            v-model="mergeTarget"
            type="radio"
            name="merge-target"
            :value="item.id"
            class="accent-sakura-500"
          />
          {{ item.title }}
          <span class="text-xs text-mist-300">{{ t(`admin.sources.${item.source}`) }}</span>
        </label>
      </fieldset>
      <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" :class="ui.button" @click="mergeOpen = false">
          {{ t('admin.common.cancel') }}
        </button>
        <button
          type="button"
          :class="ui.buttonPrimary"
          :disabled="merge.isPending.value"
          @click="confirmMerge"
        >
          {{ t('admin.series.merge') }}
        </button>
      </div>
    </AdminDialog>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="t('admin.series.deleteTitle', { title: toDelete?.title ?? '' })"
      :description="t('admin.series.deleteBody')"
      :confirm-label="t('admin.common.delete')"
      :pending="remove.isPending.value"
      danger
      @confirm="confirmDelete"
    />
    <SeriesFormDialog v-model:open="createOpen" />
    <RosterImportDialog v-model:open="rosterOpen" />
  </div>
</template>
