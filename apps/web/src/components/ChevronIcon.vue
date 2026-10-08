<script setup lang="ts">
/** Rounded chevron used by selects and pagers (inherits the text color). */
defineProps<{ direction: 'up' | 'down' | 'left' | 'right' }>()

const ROTATION = { down: 0, left: 90, up: 180, right: 270 } as const
</script>

<template>
  <svg viewBox="0 0 20 20" aria-hidden="true" class="size-4 shrink-0">
    <path
      d="M5.5 7.5 10 12l4.5-4.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      :transform="`rotate(${ROTATION[direction]} 10 10)`"
    />
  </svg>
</template>
