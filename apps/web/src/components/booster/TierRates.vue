<script setup lang="ts">
import type { BoosterTierDto } from '@gachanime/shared'
import { useI18n } from 'vue-i18n'
import { usePlayerRarities } from '@/app/rarities'
import { rarityStyle } from '@/components/cards/rarity-styles'

const RATE_TOTAL = 1_000_000

defineProps<{ tier: BoosterTierDto }>()
const { t, n } = useI18n()
const { rarities, nameOf } = usePlayerRarities()
</script>

<template>
  <details class="text-sm">
    <summary class="cursor-pointer text-mist-300 hover:text-mist-100">
      {{ t('boosters.rates') }}
    </summary>
    <ul class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
      <li
        v-for="rarity in [...rarities].reverse()"
        :key="rarity.key"
        class="flex justify-between gap-2"
      >
        <span :class="rarityStyle(rarity.key).text">{{ nameOf(rarity.key) }}</span>
        <span class="tabular-nums">{{
          n((tier.weights[rarity.key] ?? 0) / RATE_TOTAL, 'rate')
        }}</span>
      </li>
    </ul>
  </details>
</template>
