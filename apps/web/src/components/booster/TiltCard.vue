<script setup lang="ts">
import { useReducedMotion } from 'motion-v'
import { computed, ref } from 'vue'

/**
 * 3D tilt following the pointer (mouse or finger), with a glare where the light hits. Without a
 * pointer, a slow sway keeps the card alive (disabled with reduced motion).
 */
const props = withDefaults(defineProps<{ max?: number; sway?: boolean }>(), {
  max: 16,
  sway: false,
})

const reduced = useReducedMotion()
const active = ref(false)
const tilt = ref({ x: 0, y: 0 })
const glare = ref({ x: 50, y: 50 })

function onMove(event: PointerEvent): void {
  if (reduced.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const nx = (event.clientX - rect.left) / rect.width
  const ny = (event.clientY - rect.top) / rect.height
  active.value = true
  tilt.value = { x: (0.5 - ny) * 2 * props.max, y: (nx - 0.5) * 2 * props.max }
  glare.value = { x: nx * 100, y: ny * 100 }
}

function onLeave(): void {
  active.value = false
  tilt.value = { x: 0, y: 0 }
}

const transform = computed(
  () =>
    `rotateX(${tilt.value.x.toFixed(2)}deg) rotateY(${tilt.value.y.toFixed(2)}deg) scale(${active.value ? 1.03 : 1})`,
)
</script>

<template>
  <div
    class="perspective-[900px]"
    @pointermove="onMove"
    @pointerleave="onLeave"
    @pointercancel="onLeave"
  >
    <div :class="{ 'tilt-sway': sway && !active && !reduced }" class="transform-3d">
      <div
        class="relative transform-3d"
        :style="{
          transform,
          transition: active ? 'transform 90ms ease-out' : 'transform 500ms ease-out',
        }"
      >
        <slot />
        <div
          v-if="!reduced"
          class="pointer-events-none absolute inset-0 rounded-xl mix-blend-overlay transition-opacity duration-300"
          :class="active ? 'opacity-100' : 'opacity-0'"
          :style="{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgb(255 255 255 / 0.55), transparent 55%)`,
          }"
        />
      </div>
    </div>
  </div>
</template>
