<script setup lang="ts">
import {
  METRIC_KEYS,
  resolveLocalizedText,
  type AdminAchievement,
  type MetricKeyName,
} from '@gachanime/shared'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useAdminAchievementsQuery,
  useAdminRaritiesQuery,
  useAdminTiersQuery,
  useSaveAchievementMutation,
} from '@/api/admin'
import { useErrorMessage } from '@/app/errors'
import BaseDialog from '@/components/BaseDialog.vue'
import ObjectiveTextFields from '../components/ObjectiveTextFields.vue'
import { cleanLocalized } from '../text'
import { ui } from '../ui'

/** Optional parameters per metric (see the registry in `@gachanime/game`). */
const PARAMS: Partial<Record<MetricKeyName, { name: string; source: 'tier' | 'rarity' }>> = {
  boosters_opened: { name: 'tier', source: 'tier' },
  cards_obtained: { name: 'minRarity', source: 'rarity' },
  cards_recycled: { name: 'minRarity', source: 'rarity' },
  distinct_characters_owned: { name: 'rarity', source: 'rarity' },
}

interface Draft {
  id: number | null
  key: string
  name: { en: string; fr?: string }
  description: { en: string; fr?: string }
  metric: MetricKeyName
  param: string
  target: number
  rewardGems: number
  iconToken: string
  isActive: boolean
  sortOrder: number
}

const { t, n, locale } = useI18n()
const query = useAdminAchievementsQuery()
const rarities = useAdminRaritiesQuery()
const tiers = useAdminTiersQuery()
const save = useSaveAchievementMutation()
const errorMessage = useErrorMessage(save.error)
const open = ref(false)
const draft = ref<Draft | null>(null)

const paramField = computed(() => (draft.value ? PARAMS[draft.value.metric] : undefined))
const paramOptions = computed(() =>
  paramField.value?.source === 'tier'
    ? (tiers.data.value?.tiers ?? []).map((tier) => tier.key)
    : (rarities.data.value?.rarities ?? []).map((rarity) => rarity.key),
)

function describeParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ')
}

function edit(achievement: AdminAchievement | null): void {
  save.reset()
  draft.value = achievement
    ? {
        id: achievement.id,
        key: achievement.key,
        name: { ...achievement.name } as Draft['name'],
        description: { en: '', ...(achievement.description ?? {}) },
        metric: achievement.metric,
        param: String(Object.values(achievement.params)[0] ?? ''),
        target: achievement.target,
        rewardGems: achievement.rewardGems,
        iconToken: achievement.iconToken,
        isActive: achievement.isActive,
        sortOrder: achievement.sortOrder,
      }
    : {
        id: null,
        key: '',
        name: { en: '' },
        description: { en: '' },
        metric: 'boosters_opened',
        param: '',
        target: 10,
        rewardGems: 50,
        iconToken: 'star',
        isActive: true,
        sortOrder: 0,
      }
  open.value = true
}

async function submit(): Promise<void> {
  const value = draft.value
  if (!value) return
  const field = PARAMS[value.metric]
  const description = cleanLocalized(value.description)
  const fields = {
    name: cleanLocalized(value.name),
    description: description.en ? description : null,
    metric: value.metric,
    params: field && value.param ? { [field.name]: value.param } : {},
    target: value.target,
    rewardGems: value.rewardGems,
    iconToken: value.iconToken,
    isActive: value.isActive,
    sortOrder: value.sortOrder,
  }
  await save.mutateAsync(
    value.id === null
      ? { create: { ...fields, key: value.key } }
      : { id: value.id, changes: fields },
  )
  open.value = false
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-3xl font-bold">{{ t('admin.achievements.title') }}</h1>
        <p class="text-mist-300">{{ t('admin.achievements.help') }}</p>
      </div>
      <button type="button" :class="ui.buttonPrimary" @click="edit(null)">
        {{ t('admin.achievements.new') }}
      </button>
    </div>
    <p v-if="query.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <div v-else class="overflow-x-auto rounded-2xl border border-night-700">
      <table :class="ui.table">
        <thead class="bg-night-900">
          <tr>
            <th :class="ui.th">{{ t('admin.objectives.name') }}</th>
            <th :class="ui.th">{{ t('admin.achievements.metric') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.objectives.target') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.objectives.reward') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.achievements.completions') }}</th>
            <th :class="ui.th">{{ t('admin.common.active') }}</th>
            <th :class="ui.th">
              <span class="sr-only">{{ t('admin.common.edit') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="achievement in query.data.value?.achievements ?? []"
            :key="achievement.id"
            class="border-t border-night-800"
            :class="{ 'opacity-50': !achievement.isActive }"
          >
            <td :class="ui.td">
              <p class="font-semibold">{{ resolveLocalizedText(achievement.name, locale) }}</p>
              <p class="text-xs text-mist-300">{{ achievement.key }}</p>
            </td>
            <td :class="ui.td">
              <p>{{ t(`admin.achievements.metrics.${achievement.metric}`) }}</p>
              <p class="text-xs text-mist-300">{{ describeParams(achievement.params) }}</p>
            </td>
            <td :class="[ui.td, 'text-right tabular-nums']">
              {{ n(achievement.target, 'integer') }}
            </td>
            <td :class="[ui.td, 'text-right tabular-nums']">
              {{ n(achievement.rewardGems, 'integer') }}
            </td>
            <td :class="[ui.td, 'text-right tabular-nums']">
              {{ n(achievement.completions, 'integer') }}
            </td>
            <td :class="ui.td">
              {{ achievement.isActive ? t('admin.common.active') : t('admin.common.inactive') }}
            </td>
            <td :class="ui.td">
              <button type="button" :class="ui.button" @click="edit(achievement)">
                {{ t('admin.common.edit') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseDialog
      v-model:open="open"
      :title="draft?.id ? t('admin.achievements.edit') : t('admin.achievements.new')"
      wide
    >
      <form v-if="draft" class="flex flex-col gap-4" @submit.prevent="submit">
        <label v-if="draft.id === null" :class="ui.label">
          {{ t('admin.objectives.key') }}
          <input
            v-model.trim="draft.key"
            required
            pattern="[a-z][a-z0-9_]{1,63}"
            :class="ui.input"
          />
        </label>
        <ObjectiveTextFields v-model:name="draft.name" v-model:description="draft.description" />
        <div class="grid gap-3 sm:grid-cols-3">
          <label :class="ui.label">
            {{ t('admin.achievements.metric') }}
            <select v-model="draft.metric" :class="ui.select" @change="draft.param = ''">
              <option v-for="metric in METRIC_KEYS" :key="metric" :value="metric">
                {{ t(`admin.achievements.metrics.${metric}`) }}
              </option>
            </select>
          </label>
          <label v-if="paramField" :class="ui.label">
            {{ t(`admin.achievements.params.${paramField.name}`) }}
            <select v-model="draft.param" :class="ui.select">
              <option value="">{{ t('admin.achievements.anyParam') }}</option>
              <option v-for="option in paramOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>
          <label :class="ui.label">
            {{
              draft.metric === 'catalog_completion'
                ? t('admin.achievements.targetPercent')
                : t('admin.objectives.target')
            }}
            <input v-model.number="draft.target" type="number" min="1" :class="ui.input" />
          </label>
          <label :class="ui.label">
            {{ t('admin.objectives.reward') }}
            <input v-model.number="draft.rewardGems" type="number" min="0" :class="ui.input" />
          </label>
          <label :class="ui.label">
            {{ t('admin.boosters.sortOrder') }}
            <input v-model.number="draft.sortOrder" type="number" min="0" :class="ui.input" />
          </label>
          <label class="flex items-center gap-2 self-end pb-2 text-sm">
            <input v-model="draft.isActive" type="checkbox" class="accent-sakura-500" />
            {{ t('admin.common.active') }}
          </label>
        </div>
        <p class="text-xs text-mist-300">{{ t('admin.achievements.stickyHelp') }}</p>
        <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
        <div class="flex justify-end gap-3">
          <button type="button" :class="ui.button" @click="open = false">
            {{ t('admin.common.cancel') }}
          </button>
          <button type="submit" :class="ui.buttonPrimary" :disabled="save.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>
    </BaseDialog>
  </div>
</template>
