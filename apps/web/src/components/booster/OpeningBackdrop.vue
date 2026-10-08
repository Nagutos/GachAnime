<script setup lang="ts">
import { SEAL_GLYPHS } from '@/components/seal-glyphs'

/**
 * Background of the opening scene: the GachAnime seal drawn as colored outlines, a soft halo at
 * the bottom of the screen and light particles rising from the bottom and fading out.
 *
 * Built to stay smooth on small machines: nothing uses `filter` or `backdrop-filter`, soft
 * edges are gradients, and the only animated properties are `transform` and `opacity`, which
 * the browser composites without repainting.
 */
const SEAL = SEAL_GLYPHS['招']!

let seed = 5
function random(): number {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}

const particles = Array.from({ length: 16 }, (_, index) => {
  const size = 4 + random() * 10
  return {
    left: `${3 + random() * 94}%`,
    size: `${size}px`,
    color: index % 3 === 0 ? 'var(--color-gold-400)' : 'var(--color-sakura-400)',
    duration: `${6 + random() * 7}s`,
    delay: `-${random() * 13}s`,
    rise: `-${22 + random() * 26}vh`,
    drift: `${(random() - 0.5) * 60}px`,
  }
})
</script>

<template>
  <div class="opening-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
    <!-- The seal, outlines only -->
    <svg
      viewBox="0 0 64 64"
      class="absolute top-1/2 left-1/2 size-[min(78vh,82vw)] -translate-1/2 opacity-45"
      fill="none"
    >
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        stroke="var(--color-sakura-500)"
        stroke-opacity="0.18"
        stroke-width="2.4"
      />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        stroke="var(--color-sakura-400)"
        stroke-opacity="0.45"
        stroke-width="0.35"
      />
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="10"
        stroke="var(--color-night-500)"
        stroke-opacity="0.6"
        stroke-width="0.3"
      />
      <path :d="SEAL" stroke="var(--color-sakura-500)" stroke-opacity="0.16" stroke-width="1.6" />
      <path :d="SEAL" stroke="var(--color-sakura-400)" stroke-opacity="0.5" stroke-width="0.3" />
    </svg>

    <!-- Halo at the bottom of the screen -->
    <div class="opening-halo absolute inset-x-0 bottom-0 h-[45vh]" />

    <!-- Particles rising from the bottom, then fading -->
    <span
      v-for="(particle, index) in particles"
      :key="index"
      class="opening-particle absolute bottom-[2vh] rounded-full"
      :style="{
        left: particle.left,
        width: particle.size,
        height: particle.size,
        '--particle-color': particle.color,
        '--particle-rise': particle.rise,
        '--particle-drift': particle.drift,
        animationDuration: particle.duration,
        animationDelay: particle.delay,
      }"
    />
  </div>
</template>
