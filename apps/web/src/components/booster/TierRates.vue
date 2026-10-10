<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePlayerRarities } from '@/app/rarities'
import { rarityStyle } from '@/components/cards/rarity-styles'

const RATE_TOTAL = 1_000_000

/** Per-card rates; with `base`, the rates that went up are marked (weekly packs). */
const props = defineProps<{ weights: Record<string, number>; base?: Record<string, number> }>()
const { t, n } = useI18n()
const { rarities, nameOf } = usePlayerRarities()

const boosted = (key: string) =>
  props.base !== undefined && (props.weights[key] ?? 0) > (props.base[key] ?? 0)
</script>

<template>
  <details class="text-sm">
    <summary class="cursor-pointer text-mist-300 hover:text-mist-100">
      {{ base ? t('boosters.weekly.rates') : t('boosters.rates') }}
    </summary>
    <ul class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
      <li
        v-for="rarity in [...rarities].reverse()"
        :key="rarity.key"
        class="flex justify-between gap-2"
      >
        <span :class="rarityStyle(rarity.key).text">{{ nameOf(rarity.key) }}</span>
        <span
          class="tabular-nums"
          :class="{ 'font-semibold text-emerald-400': boosted(rarity.key) }"
        >
          <span v-if="boosted(rarity.key)" class="sr-only">{{ t('boosters.weekly.boosted') }}</span>
          <svg
            v-if="boosted(rarity.key)"
            viewBox="0 0 10 10"
            class="mr-0.5 inline size-2.5 fill-current align-baseline"
            aria-hidden="true"
          >
            <path d="M5 1 9.5 9h-9z" />
          </svg>
          {{ n((weights[rarity.key] ?? 0) / RATE_TOTAL, 'rate') }}
        </span>
      </li>
    </ul>
  </details>
</template>
