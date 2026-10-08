<script setup lang="ts">
import type { SeriesRef } from '@gachanime/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { usePlayerRarities } from '@/app/rarities'
import { frameStyle, rarityStyle } from './rarity-styles'

const props = withDefaults(
  defineProps<{
    name: string
    imageUrl: string | null
    rarityKey: string
    series?: SeriesRef | null
    quantity?: number
    isNew?: boolean
    /** Animated sheen for the highest rarities. */
    effects?: boolean
    /**
     * The card links to `to` (its wiki page) and its series title to the player's collection of
     * that series. Without it
     * the card has no link, so that a parent may make the whole card a link or a button.
     */
    to?: RouteLocationRaw
  }>(),
  { series: null, quantity: 0, isNew: false, effects: true, to: undefined },
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
    class="card-frame relative aspect-5/7 w-full overflow-hidden rounded-xl p-[5px] shadow-lg has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-sakura-400"
    :class="[style.glow, effectClass, { 'card-frame-mythic': rarityKey === 'mythic' }]"
    :style="frameStyle(rarityKey)"
    data-testid="character-card"
  >
    <div class="card-window relative size-full overflow-hidden rounded-lg bg-night-800">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="name"
        loading="lazy"
        referrerpolicy="no-referrer"
        draggable="false"
        class="absolute inset-0 size-full object-cover select-none"
      />
      <div
        v-else
        class="absolute inset-0 flex items-center justify-center font-display text-5xl font-bold text-mist-300/30"
        aria-hidden="true"
      >
        {{ name.charAt(0) }}
      </div>
      <!-- Name plate, edged with the rarity color -->
      <div class="card-plate absolute inset-x-0 bottom-0 px-2 pt-1.5 pb-2">
        <p class="truncate text-sm leading-tight font-bold" :title="name">
          <!-- Stretched link: its ::after covers the card, the series link sits above it -->
          <RouterLink
            v-if="to"
            :to="to"
            class="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {{ name }}
          </RouterLink>
          <template v-else>{{ name }}</template>
        </p>
        <template v-if="series">
          <RouterLink
            v-if="to"
            :to="{ name: 'collection', query: { series: series.id, seriesTitle: series.title } }"
            class="relative z-10 block truncate text-[11px] text-mist-300 underline-offset-2 hover:text-sakura-400 hover:underline focus-visible:text-sakura-400 focus-visible:underline focus-visible:outline-none"
            :title="t('cards.seriesLink', { series: series.title })"
            data-testid="card-series-link"
          >
            {{ series.title }}
          </RouterLink>
          <p v-else class="truncate text-[11px] text-mist-300" :title="series.title">
            {{ series.title }}
          </p>
        </template>
      </div>
      <!-- Badges stack on the left so they never overlap, even on small cards -->
      <div
        class="pointer-events-none absolute top-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] flex-col items-start gap-1"
      >
        <span
          class="max-w-full truncate rounded-full bg-night-950/85 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
          :class="style.text"
        >
          {{ nameOf(rarityKey) }}
        </span>
        <span
          v-if="isNew"
          class="rounded-full bg-sakura-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase shadow"
          data-testid="new-badge"
        >
          {{ t('cards.new') }}
        </span>
      </div>
      <span
        v-if="quantity > 1"
        class="pointer-events-none absolute top-1.5 right-1.5 rounded-full bg-gold-400 px-2 py-0.5 text-[11px] font-bold text-night-950 shadow"
      >
        {{ t('cards.quantity', { count: quantity }) }}
      </span>
    </div>
  </div>
</template>
