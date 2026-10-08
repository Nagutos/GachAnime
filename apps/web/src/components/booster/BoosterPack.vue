<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v'
import { computed } from 'vue'
import PackFace from './PackFace.vue'
import { PACK_TEAR_MS, packShape } from './pack-shape'

const props = withDefaults(
  defineProps<{
    label: string
    cards: number
    /** The pack is torn open: the top strip rips off along the tear line, the body drops. */
    torn?: boolean
    /** Rarity hinted by the pack glow (highest card of the pack, epic or better). */
    glowRarity?: string | null
    /** Gentle floating while waiting to be opened. */
    idle?: boolean
    /** Tier art token: pack color. */
    art?: string
    /** Themed pack name, shown on a ribbon. */
    ribbon?: string | null
  }>(),
  { torn: false, glowRarity: null, idle: false, art: 'free', ribbon: null },
)

const shape = packShape()
const reduced = useReducedMotion()

/** Seconds of the tear (see `PACK_TEAR_MS`, which BoosterOpening waits for). */
const TEAR = PACK_TEAR_MS / 1000

/** Clip-paths ignore box-shadow: the glow is a drop-shadow, which follows the serrated outline. */
const glowStyle = computed(() => ({
  filter: props.glowRarity
    ? `drop-shadow(0 0 22px color-mix(in oklab, var(--color-rarity-${props.glowRarity}) 75%, transparent))`
    : 'drop-shadow(0 18px 24px rgb(0 0 0 / 0.45))',
}))

const stripAnimation = computed(() =>
  props.torn
    ? {
        rotate: [0, -6, -38],
        x: [0, 2, -40],
        y: [0, -4, -150],
        opacity: [1, 1, 0],
      }
    : { rotate: 0, x: 0, y: 0, opacity: 1 },
)
const bodyAnimation = computed(() =>
  props.torn
    ? { x: [0, -3, 3, -2, 0, 0], y: [0, 0, 0, 0, 0, 90], opacity: [1, 1, 1, 1, 1, 0] }
    : { x: 0, y: 0, opacity: 1 },
)
</script>

<template>
  <motion.div
    class="group/pack relative aspect-3/5 w-full select-none"
    :style="glowStyle"
    :animate="idle && !reduced ? { y: [0, -8, 0] } : { y: 0 }"
    :transition="idle ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }"
  >
    <!-- Body: everything below the tear line -->
    <motion.div
      class="absolute inset-0"
      :style="{ clipPath: shape.body }"
      :animate="bodyAnimation"
      :transition="{
        duration: reduced ? 0 : TEAR + 0.35,
        times: [0, 0.08, 0.16, 0.24, 0.65, 1],
        ease: 'easeIn',
      }"
    >
      <PackFace :label="label" :cards="cards" :art="art" :ribbon="ribbon" :tear-at="shape.tearAt" />
    </motion.div>

    <!-- Light escaping from the opening -->
    <motion.div
      v-if="torn && !reduced"
      class="pointer-events-none absolute inset-x-[4%] h-[6%] rounded-full bg-gradient-to-r from-transparent via-white to-transparent blur-md"
      :style="{ top: `${shape.tearAt - 3}%` }"
      :initial="{ opacity: 0, scaleX: 0.2 }"
      :animate="{ opacity: [0, 1, 0.7, 0], scaleX: [0.2, 1, 1.1, 1.3] }"
      :transition="{ duration: TEAR + 0.3, ease: 'easeOut' }"
    />

    <!-- Top strip, torn from the right and pivoting on its left end (lifts a bit on hover) -->
    <div
      class="absolute inset-0 transition-transform duration-300"
      :class="{ 'group-hover/pack:-rotate-2': !torn && idle }"
      :style="{ transformOrigin: `0% ${shape.tearAt}%` }"
      aria-hidden="true"
    >
      <motion.div
        class="absolute inset-0"
        :style="{ clipPath: shape.strip, transformOrigin: `0% ${shape.tearAt}%` }"
        :animate="stripAnimation"
        :transition="{ duration: reduced ? 0 : TEAR, times: [0, 0.3, 1], ease: 'easeOut' }"
      >
        <PackFace
          :label="label"
          :cards="cards"
          :art="art"
          :ribbon="ribbon"
          :tear-at="shape.tearAt"
        />
      </motion.div>
    </div>
  </motion.div>
</template>
