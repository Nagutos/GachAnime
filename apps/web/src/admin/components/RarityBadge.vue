<script setup lang="ts">
import { useRarities } from '../use-rarities'
import { rarityClasses } from '../ui'

defineProps<{ rarity: string }>()
const { nameOf } = useRarities()
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold"
    :class="rarityClasses[rarity] ?? 'border-night-500 text-mist-300'"
  >
    {{ nameOf(rarity) }}
  </span>
</template>
