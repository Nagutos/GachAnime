<script setup lang="ts">
import type { CharacterCard } from '@gachanime/shared'
import { useI18n } from 'vue-i18n'
import { frameStyle } from '@/components/cards/rarity-styles'

/** Thumbnail of a player's main favorite (first of their favorites), next to their name. */
defineProps<{ card: CharacterCard; size?: 'sm' | 'lg' }>()
const { t } = useI18n()
</script>

<template>
  <span
    class="card-frame relative shrink-0 overflow-hidden rounded-md p-0.5"
    :class="size === 'lg' ? 'h-28 w-20 rounded-lg p-1' : 'h-10 w-7'"
    :style="frameStyle(card.rarityKey)"
    :title="t('favorites.featured', { name: card.name })"
    data-testid="featured-card"
  >
    <img
      v-if="card.imageUrl"
      :src="card.imageUrl"
      :alt="t('favorites.featured', { name: card.name })"
      referrerpolicy="no-referrer"
      class="size-full rounded-[3px] bg-night-800 object-cover"
    />
    <span
      v-else
      class="flex size-full items-center justify-center rounded-[3px] bg-night-800 text-xs font-bold text-mist-300"
      :aria-label="t('favorites.featured', { name: card.name })"
    >
      {{ card.name.charAt(0) }}
    </span>
  </span>
</template>
