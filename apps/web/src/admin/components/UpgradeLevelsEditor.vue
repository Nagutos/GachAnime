<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ui } from '../ui'

export interface UpgradeLevelDraft {
  cost: number
  value: number
}

const props = defineProps<{
  /** Label of the value column (charges, %, multiplier). */
  valueLabel: string
  min: number
  max: number
  step: number
  testid: string
}>()
const levels = defineModel<UpgradeLevelDraft[]>({ required: true })
const { t } = useI18n()

const MAX_LEVELS = 20
/** Table cell, tighter on phones. */
const cell = 'px-1 py-2 align-middle sm:px-3'
const head = ui.th.replace('px-3', 'px-1 sm:px-3')
const input = `${ui.input.replace('px-3', 'px-2 sm:px-3')} min-w-0`

function add(): void {
  const last = levels.value.at(-1)
  levels.value = [
    ...levels.value,
    last
      ? { cost: last.cost * 2, value: Math.min(props.max, last.value + props.step) }
      : { cost: 1_000, value: props.min },
  ]
}

function remove(index: number): void {
  levels.value = levels.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="flex flex-col gap-2" :data-testid="testid">
    <p v-if="levels.length === 0" class="text-sm text-mist-300">
      {{ t('admin.settings.upgrades.noLevel') }}
    </p>
    <!-- Scrolls on its own if it still does not fit (phones): never the whole page -->
    <div v-else class="overflow-x-auto">
      <table :class="[ui.table, 'table-fixed']">
        <colgroup>
          <col class="w-12" />
          <col />
          <col />
          <col class="w-12" />
        </colgroup>
        <thead>
          <tr>
            <th :class="head">{{ t('admin.settings.upgrades.level') }}</th>
            <th :class="head">{{ t('admin.settings.upgrades.cost') }}</th>
            <th :class="head">{{ valueLabel }}</th>
            <th :class="head">
              <span class="sr-only">{{ t('admin.settings.upgrades.actions') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(level, index) in levels" :key="index">
            <td :class="[cell, 'tabular-nums']">{{ index + 1 }}</td>
            <td :class="cell">
              <input
                v-model.number="level.cost"
                type="number"
                min="0"
                step="1"
                :class="input"
                :aria-label="t('admin.settings.upgrades.costOf', { level: index + 1 })"
              />
            </td>
            <td :class="cell">
              <input
                v-model.number="level.value"
                type="number"
                :min="min"
                :max="max"
                :step="step"
                :class="input"
                :aria-label="`${valueLabel} (${index + 1})`"
              />
            </td>
            <td :class="[cell, 'text-right']">
              <button
                type="button"
                :class="[ui.button, 'px-2']"
                :aria-label="t('admin.settings.upgrades.removeLevel', { level: index + 1 })"
                :title="t('admin.settings.upgrades.removeLevel', { level: index + 1 })"
                @click="remove(index)"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  class="size-4 fill-none stroke-current stroke-2"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <button type="button" :class="ui.button" :disabled="levels.length >= MAX_LEVELS" @click="add">
        {{ t('admin.settings.upgrades.add') }}
      </button>
    </div>
  </div>
</template>
