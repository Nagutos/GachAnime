<script setup lang="ts">
import type { CharacterCard } from '@gachanime/shared'
import { useI18n } from 'vue-i18n'
import { usePlayerRarities } from '@/app/rarities'
import { rarityStyle } from '@/components/cards/rarity-styles'

/** Compact card line: trades, market history. */
withDefaults(
  defineProps<{ character: CharacterCard; quantity?: number; wished?: string | null }>(),
  { quantity: 1, wished: null },
)
const { t } = useI18n()
const { nameOf } = usePlayerRarities()
</script>

<template>
  <div class="flex items-center gap-3 rounded-lg bg-night-800/60 p-1.5 pr-3">
    <img
      v-if="character.imageUrl"
      :src="character.imageUrl"
      alt=""
      referrerpolicy="no-referrer"
      class="aspect-5/7 w-16 shrink-0 rounded-md border-2 object-cover sm:w-20"
      :class="rarityStyle(character.rarityKey).frame"
    />
    <div class="min-w-0 flex-1">
      <p class="truncate font-semibold">{{ character.name }}</p>
      <p v-if="character.series" class="truncate text-xs text-mist-300">
        {{ character.series.title }}
      </p>
      <p class="mt-1 text-xs" :class="rarityStyle(character.rarityKey).text">
        {{ nameOf(character.rarityKey) }}
        <span v-if="wished" class="ml-1 rounded bg-sakura-500/20 px-1 text-sakura-400">
          {{ wished }}
        </span>
      </p>
    </div>
    <span v-if="quantity > 1" class="font-bold text-gold-400">
      {{ t('cards.quantity', { count: quantity }) }}
    </span>
  </div>
</template>
