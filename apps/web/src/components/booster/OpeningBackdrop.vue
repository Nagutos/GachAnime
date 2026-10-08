<script setup lang="ts">
/**
 * Background of the opening scene: soft blurred light particles drifting slowly upwards, in the
 * app colors. Positions come from a fixed pseudo-random sequence (same scene on every render);
 * with reduced motion the particles stay still (see main.css).
 */
const COLORS = [
  'var(--color-sakura-400)',
  'var(--color-gold-400)',
  'var(--color-night-500)',
  'var(--color-rarity-rare)',
  'var(--color-rarity-epic)',
]

let seed = 11
function random(): number {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}

const particles = Array.from({ length: 30 }, (_, index) => {
  const size = 18 + random() * 110
  return {
    left: `${random() * 100}%`,
    top: `${random() * 100}%`,
    size: `${size}px`,
    color: COLORS[index % COLORS.length],
    opacity: 0.12 + random() * 0.3,
    blur: `${Math.round(size / 5 + 6)}px`,
    duration: `${18 + random() * 22}s`,
    delay: `-${random() * 40}s`,
  }
})
</script>

<template>
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <div
      class="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(91_84_160/0.28),transparent_65%)]"
    />
    <span
      v-for="(particle, index) in particles"
      :key="index"
      class="opening-particle absolute rounded-full"
      :style="{
        left: particle.left,
        top: particle.top,
        width: particle.size,
        height: particle.size,
        background: particle.color,
        opacity: particle.opacity,
        filter: `blur(${particle.blur})`,
        animationDuration: particle.duration,
        animationDelay: particle.delay,
      }"
    />
  </div>
</template>
