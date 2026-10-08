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
    /** Art token (tier or pack): pack colors. */
    art?: string
    /** Kanji on the seal. */
    seal?: string
    /** Faces the screen instead of standing a bit sideways (selected pack, opening scene). */
    front?: boolean
  }>(),
  { torn: false, glowRarity: null, idle: false, art: 'free', seal: '招', front: false },
)

const shape = packShape()
const reduced = useReducedMotion()

/** Seconds of the tear (see `PACK_TEAR_MS`, which BoosterOpening waits for). */
const TEAR = PACK_TEAR_MS / 1000

/**
 * Shadow and rarity glow are gradients behind the pack, not `filter: drop-shadow`: a filter is
 * computed again on every frame where the pack content moves (sheen, tear).
 */
const glowStyle = computed(() =>
  props.glowRarity
    ? {
        background: `radial-gradient(closest-side, var(--color-rarity-${props.glowRarity}), transparent)`,
      }
    : null,
)

const stripAnimation = {
  rotate: [0, -6, -38],
  x: [0, 2, -40],
  y: [0, -4, -150],
  opacity: [1, 1, 0],
}
const bodyAnimation = {
  x: [0, -3, 3, -2, 0, 0],
  y: [0, 0, 0, 0, 0, 90],
  opacity: [1, 1, 1, 1, 1, 0],
}
</script>

<template>
  <motion.div
    class="group/pack relative aspect-3/5 w-full select-none"
    :animate="idle && !reduced && !torn ? { y: [0, -8, 0] } : { y: 0 }"
    :transition="idle ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }"
  >
    <!-- Sideways by default, facing the screen with a slight zoom on hover (pack-pose, CSS) -->
    <div class="pack-pose absolute inset-0" :class="{ 'pack-pose-front': front || torn }">
      <div
        v-if="glowStyle"
        class="absolute -inset-[18%] opacity-70"
        :style="glowStyle"
        aria-hidden="true"
      />
      <div
        class="pack-ground-shadow absolute inset-x-[6%] -bottom-[7%] h-[12%]"
        aria-hidden="true"
      />
      <!-- In one piece until it is torn: no visible cut line -->
      <div v-if="!torn" class="absolute inset-0" :style="{ clipPath: shape.full }">
        <PackFace :label="label" :cards="cards" :art="art" :seal="seal" />
      </div>
      <template v-else>
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
          <PackFace :label="label" :cards="cards" :art="art" :seal="seal" />
        </motion.div>

        <!-- Light escaping from the opening -->
        <motion.div
          v-if="!reduced"
          class="pointer-events-none absolute inset-x-[4%] h-[6%] rounded-full bg-linear-to-r from-transparent via-white to-transparent blur-md"
          :style="{ top: `${shape.tearAt - 3}%` }"
          :initial="{ opacity: 0, scaleX: 0.2 }"
          :animate="{ opacity: [0, 1, 0.7, 0], scaleX: [0.2, 1, 1.1, 1.3] }"
          :transition="{ duration: TEAR + 0.3, ease: 'easeOut' }"
        />

        <!-- Top strip, torn from the right and pivoting on its left end -->
        <motion.div
          class="absolute inset-0"
          :style="{ clipPath: shape.strip, transformOrigin: `0% ${shape.tearAt}%` }"
          :animate="reduced ? { opacity: 0 } : stripAnimation"
          :transition="{ duration: reduced ? 0 : TEAR, times: [0, 0.3, 1], ease: 'easeOut' }"
          aria-hidden="true"
        >
          <PackFace :label="label" :cards="cards" :art="art" :seal="seal" />
        </motion.div>
      </template>
    </div>
  </motion.div>
</template>
