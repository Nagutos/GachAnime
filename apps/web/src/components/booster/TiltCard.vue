<script setup lang="ts">
import { useReducedMotion } from 'motion-v'
import { onBeforeUnmount, ref } from 'vue'

/**
 * 3D tilt following the pointer (mouse or finger), with a glare where the light hits. Without a
 * pointer, a slow sway keeps the card alive (disabled with reduced motion).
 *
 * Cheap on small machines: pointer moves are coalesced to one update per frame, written as CSS
 * variables straight on the element (no Vue re-render), and only `transform` and `opacity`
 * change. Perspective is part of the transform and no level preserves 3D: with preserve-3d,
 * half of a tilted card went behind its parent's plane and clicks landed on the parent.
 */
const props = withDefaults(defineProps<{ max?: number; sway?: boolean }>(), {
  max: 16,
  sway: false,
})

const reduced = useReducedMotion()
const active = ref(false)
const card = ref<HTMLElement | null>(null)
let frame = 0
let pending: { nx: number; ny: number } | null = null

function apply(): void {
  frame = 0
  const element = card.value
  if (!element || !pending) return
  const { nx, ny } = pending
  element.style.setProperty('--tilt-x', `${((0.5 - ny) * 2 * props.max).toFixed(2)}deg`)
  element.style.setProperty('--tilt-y', `${((nx - 0.5) * 2 * props.max).toFixed(2)}deg`)
  element.style.setProperty('--glare-x', `${(nx * 100).toFixed(1)}%`)
  element.style.setProperty('--glare-y', `${(ny * 100).toFixed(1)}%`)
}

function onMove(event: PointerEvent): void {
  if (reduced.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pending = {
    nx: (event.clientX - rect.left) / rect.width,
    ny: (event.clientY - rect.top) / rect.height,
  }
  if (!active.value) active.value = true
  if (!frame) frame = requestAnimationFrame(apply)
}

function onLeave(): void {
  active.value = false
  pending = { nx: 0.5, ny: 0.5 }
  if (!frame) frame = requestAnimationFrame(apply)
}

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div @pointermove="onMove" @pointerleave="onLeave" @pointercancel="onLeave">
    <div :class="{ 'tilt-sway': sway && !active && !reduced }">
      <div ref="card" class="tilt-card relative" :class="{ 'tilt-active': active }">
        <slot />
        <div
          v-if="!reduced"
          class="tilt-glare pointer-events-none absolute inset-0 rounded-xl"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
</template>
