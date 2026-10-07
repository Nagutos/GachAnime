<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerRarities } from '@/app/rarities'
import { rarityStyle } from './rarity-styles'

const props = withDefaults(
  defineProps<{
    name: string
    imageUrl: string | null
    rarityKey: string
    seriesTitle?: string | null
    quantity?: number
    isNew?: boolean
    /** Animated sheen for the highest rarities. */
    effects?: boolean
  }>(),
  { seriesTitle: null, quantity: 0, isNew: false, effects: true },
)

const { t } = useI18n()
const { nameOf } = usePlayerRarities()
const style = computed(() => rarityStyle(props.rarityKey))
const effectClass = computed(() => {
  if (!props.effects) return null
  if (props.rarityKey === 'mythic') return 'card-holo'
  if (props.rarityKey === 'legendary') return 'card-shine'
  return null
})
</script>

<template>
  <div
    class="relative aspect-5/7 w-full overflow-hidden rounded-xl border-2 bg-night-800 shadow-lg"
    :class="[style.frame, style.glow, effectClass]"
    data-testid="character-card"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="name"
      loading="lazy"
      referrerpolicy="no-referrer"
      class="absolute inset-0 size-full object-cover"
    />
    <div
      v-else
      class="absolute inset-0 flex items-center justify-center font-display text-5xl font-bold text-mist-300/30"
      aria-hidden="true"
    >
      {{ name.charAt(0) }}
    </div>
    <div
      class="absolute inset-x-0 bottom-0 bg-linear-to-t from-night-950 via-night-950/85 to-transparent px-2 pt-8 pb-2"
    >
      <p class="truncate text-sm leading-tight font-bold" :title="name">{{ name }}</p>
      <p v-if="seriesTitle" class="truncate text-[11px] text-mist-300" :title="seriesTitle">
        {{ seriesTitle }}
      </p>
    </div>
    <!-- Badges stack on the left so they never overlap, even on small cards -->
    <div
      class="absolute top-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] flex-col items-start gap-1"
    >
      <span
        class="max-w-full truncate rounded-full bg-night-950/85 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
        :class="style.text"
      >
        {{ nameOf(rarityKey) }}
      </span>
      <span
        v-if="isNew"
        class="rounded-full bg-sakura-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase shadow"
        data-testid="new-badge"
      >
        {{ t('cards.new') }}
      </span>
    </div>
    <span
      v-if="quantity > 1"
      class="absolute top-1.5 right-1.5 rounded-full bg-gold-400 px-2 py-0.5 text-[11px] font-bold text-night-950 shadow"
    >
      {{ t('cards.quantity', { count: quantity }) }}
    </span>
  </div>
</template>
