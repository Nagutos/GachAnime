<script setup lang="ts">
import type { SeriesRef } from '@gachanime/shared'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import CharacterCard from './CharacterCard.vue'

/** A character not obtained yet: its card, greyed, with a lock (the wiki entry stays locked). */
defineProps<{
  name: string
  imageUrl: string | null
  rarityKey: string
  series?: SeriesRef | null
  to?: RouteLocationRaw
}>()
const { t } = useI18n()
</script>

<template>
  <div class="relative" data-testid="locked-card">
    <CharacterCard
      :name="name"
      :image-url="imageUrl"
      :rarity-key="rarityKey"
      :series="series"
      :to="to"
      :effects="false"
      class="opacity-60 grayscale"
    />
    <span
      class="pointer-events-none absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-night-950/85 text-mist-300"
      :title="t('wiki.lockedTitle')"
    >
      <svg viewBox="0 0 24 24" class="size-3.5 fill-current" aria-hidden="true">
        <path
          d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3Z"
        />
      </svg>
      <span class="sr-only">{{ t('wiki.lockedTitle') }}</span>
    </span>
  </div>
</template>
