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
    <table v-else :class="ui.table">
      <thead>
        <tr>
          <th :class="ui.th">{{ t('admin.settings.upgrades.level') }}</th>
          <th :class="ui.th">{{ t('admin.settings.upgrades.cost') }}</th>
          <th :class="ui.th">{{ valueLabel }}</th>
          <th :class="ui.th">
            <span class="sr-only">{{ t('admin.settings.upgrades.actions') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(level, index) in levels" :key="index">
          <td :class="[ui.td, 'tabular-nums']">{{ index + 1 }}</td>
          <td :class="ui.td">
            <input
              v-model.number="level.cost"
              type="number"
              min="0"
              step="1"
              :class="ui.input"
              :aria-label="t('admin.settings.upgrades.costOf', { level: index + 1 })"
            />
          </td>
          <td :class="ui.td">
            <input
              v-model.number="level.value"
              type="number"
              :min="min"
              :max="max"
              :step="step"
              :class="ui.input"
              :aria-label="`${valueLabel} (${index + 1})`"
            />
          </td>
          <td :class="[ui.td, 'text-right']">
            <button type="button" :class="ui.button" @click="remove(index)">
              {{ t('admin.settings.upgrades.remove') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div>
      <button type="button" :class="ui.button" :disabled="levels.length >= MAX_LEVELS" @click="add">
        {{ t('admin.settings.upgrades.add') }}
      </button>
    </div>
  </div>
</template>
