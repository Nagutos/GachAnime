<script setup lang="ts">
import type { AdminRarity } from '@gachanime/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminRaritiesQuery, useCatalogStatsQuery, useUpdateRarityMutation } from '@/api/admin'
import { useErrorMessage } from '@/app/errors'
import { cleanLocalized } from '../text'
import { rarityClasses, ui } from '../ui'

const { t, n } = useI18n()
const query = useAdminRaritiesQuery()
const stats = useCatalogStatsQuery()
const update = useUpdateRarityMutation()
const errorMessage = useErrorMessage(update.error)

/** Editable copies, one per rarity. */
const drafts = ref<Record<string, AdminRarity>>({})
watch(
  () => query.data.value,
  (value) => {
    if (!value) return
    drafts.value = Object.fromEntries(
      value.rarities.map((rarity) => [
        rarity.key,
        JSON.parse(JSON.stringify(rarity)) as AdminRarity,
      ]),
    )
  },
  { immediate: true },
)
const rows = computed(() => query.data.value?.rarities ?? [])
const message = ref<string | null>(null)

function countOf(key: string): number {
  return stats.data.value?.rarities.find((rarity) => rarity.key === key)?.characterCount ?? 0
}

function changesOf(original: AdminRarity) {
  const draft = drafts.value[original.key]!
  const changes: Partial<AdminRarity> = {}
  for (const field of [
    'favouritesThreshold',
    'gamePopularityThreshold',
    'recycleValue',
    'marketMinPrice',
    'marketMaxPrice',
  ] as const) {
    if (draft[field] !== original[field]) changes[field] = draft[field]
  }
  const name = cleanLocalized(draft.name)
  if (JSON.stringify(name) !== JSON.stringify(original.name)) changes.name = name
  return changes
}

async function save(original: AdminRarity): Promise<void> {
  message.value = null
  const changes = changesOf(original)
  if (Object.keys(changes).length === 0) return
  const result = await update.mutateAsync({ key: original.key, changes }).catch(() => null)
  if (result) {
    message.value =
      result.recomputedCharacters > 0
        ? t('admin.rarities.recomputed', { count: n(result.recomputedCharacters, 'integer') })
        : t('admin.common.saved')
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="font-display text-3xl font-bold">{{ t('admin.rarities.title') }}</h1>
      <p class="text-mist-300">{{ t('admin.rarities.help') }}</p>
    </div>
    <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
    <p v-if="message" class="text-sm text-emerald-400" role="status">{{ message }}</p>
    <p v-if="query.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <div v-else class="overflow-x-auto rounded-2xl border border-night-700">
      <table :class="ui.table">
        <thead class="bg-night-900">
          <tr>
            <th :class="ui.th">{{ t('admin.rarities.columns.rarity') }}</th>
            <th :class="ui.th">{{ t('admin.rarities.columns.nameEn') }}</th>
            <th :class="ui.th">{{ t('admin.rarities.columns.nameFr') }}</th>
            <th :class="ui.th">{{ t('admin.rarities.columns.threshold') }}</th>
            <th :class="ui.th">{{ t('admin.rarities.columns.gameThreshold') }}</th>
            <th :class="ui.th">{{ t('admin.rarities.columns.recycle') }}</th>
            <th :class="ui.th">{{ t('admin.rarities.columns.marketMin') }}</th>
            <th :class="ui.th">{{ t('admin.rarities.columns.marketMax') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.rarities.columns.characters') }}</th>
            <th :class="ui.th">
              <span class="sr-only">{{ t('admin.common.save') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="rarity in rows"
            :key="rarity.key"
            class="border-t border-night-800"
            :data-testid="`rarity-row-${rarity.key}`"
          >
            <template v-if="drafts[rarity.key]">
              <td :class="ui.td">
                <span
                  class="rounded-full border px-2 py-0.5 text-xs font-semibold"
                  :class="rarityClasses[rarity.colorToken]"
                >
                  {{ rarity.key }}
                </span>
              </td>
              <td :class="ui.td">
                <input
                  v-model.trim="drafts[rarity.key]!.name.en"
                  :class="[ui.input, 'min-w-28']"
                  :aria-label="t('admin.rarities.columns.nameEn')"
                />
              </td>
              <td :class="ui.td">
                <input
                  v-model.trim="drafts[rarity.key]!.name.fr"
                  :class="[ui.input, 'min-w-28']"
                  :aria-label="t('admin.rarities.columns.nameFr')"
                />
              </td>
              <td :class="ui.td">
                <input
                  v-model.number="drafts[rarity.key]!.favouritesThreshold"
                  type="number"
                  min="0"
                  :class="[ui.input, 'w-28']"
                  :aria-label="t('admin.rarities.columns.threshold')"
                />
              </td>
              <td :class="ui.td">
                <input
                  v-model.number="drafts[rarity.key]!.gamePopularityThreshold"
                  type="number"
                  min="0"
                  :class="[ui.input, 'w-24']"
                  :aria-label="t('admin.rarities.columns.gameThreshold')"
                />
              </td>
              <td :class="ui.td">
                <input
                  v-model.number="drafts[rarity.key]!.recycleValue"
                  type="number"
                  min="0"
                  :class="[ui.input, 'w-20']"
                  :aria-label="t('admin.rarities.columns.recycle')"
                />
              </td>
              <td :class="ui.td">
                <input
                  v-model.number="drafts[rarity.key]!.marketMinPrice"
                  type="number"
                  min="0"
                  :class="[ui.input, 'w-24']"
                  :aria-label="t('admin.rarities.columns.marketMin')"
                />
              </td>
              <td :class="ui.td">
                <input
                  v-model.number="drafts[rarity.key]!.marketMaxPrice"
                  type="number"
                  min="0"
                  :class="[ui.input, 'w-24']"
                  :aria-label="t('admin.rarities.columns.marketMax')"
                />
              </td>
              <td :class="[ui.td, 'text-right tabular-nums']">
                {{ n(countOf(rarity.key), 'integer') }}
              </td>
              <td :class="ui.td">
                <button
                  type="button"
                  :class="ui.buttonPrimary"
                  :disabled="update.isPending.value || Object.keys(changesOf(rarity)).length === 0"
                  @click="save(rarity)"
                >
                  {{ t('admin.common.save') }}
                </button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-sm text-mist-300">{{ t('admin.rarities.thresholdHelp') }}</p>
  </div>
</template>
