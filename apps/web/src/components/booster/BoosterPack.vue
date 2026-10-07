<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { rarityStyle } from '@/components/cards/rarity-styles'

const props = withDefaults(
  defineProps<{
    label: string
    cards: number
    /** The pack is torn open: the top strip flies away, the body drops. */
    torn?: boolean
    /** Rarity hinted by the pack glow (highest card of the pack, epic or better). */
    glowRarity?: string | null
    /** Gentle floating while waiting to be opened. */
    idle?: boolean
    /** Tier art token: pack color. */
    art?: string
  }>(),
  { torn: false, glowRarity: null, idle: false, art: 'free' },
)

const { t } = useI18n()
const reduced = useReducedMotion()
const glow = computed(() => (props.glowRarity ? rarityStyle(props.glowRarity).glow : null))
const duration = computed(() => (reduced.value ? 0 : 0.45))
</script>

<template>
  <motion.div
    class="relative aspect-3/5 w-full select-none"
    :animate="idle && !reduced ? { y: [0, -8, 0] } : { y: 0 }"
    :transition="idle ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }"
  >
    <!-- Top strip, torn away when opening -->
    <motion.div
      class="pack-crimp absolute inset-x-0 top-0 z-10 h-[9%] rounded-t-2xl bg-sakura-600"
      :animate="
        torn ? { y: -140, x: 40, rotate: 18, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }
      "
      :transition="{ duration: duration, ease: 'easeOut' }"
    />
    <motion.div
      class="pack-foil absolute inset-x-0 top-[9%] bottom-0 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-b-2xl border border-mist-100/20 p-4 text-center shadow-2xl"
      :class="[`pack-art-${art}`, glow ? ['shadow-[0_0_60px_-5px]', glow] : null]"
      :animate="torn ? { y: 60, opacity: 0, scale: 0.92 } : { y: 0, opacity: 1, scale: 1 }"
      :transition="{ duration: duration, ease: 'easeIn', delay: reduced ? 0 : 0.12 }"
    >
      <img src="/favicon.svg" alt="" class="size-16 drop-shadow-lg" />
      <p class="font-display text-xl font-extrabold text-white drop-shadow">{{ label }}</p>
      <p class="rounded-full bg-night-950/50 px-3 py-0.5 text-xs text-mist-100">
        {{ t('boosters.cardsPerPack', { count: cards }) }}
      </p>
      <div class="pack-crimp absolute inset-x-0 bottom-0 h-3 opacity-60" />
    </motion.div>
  </motion.div>
</template>
