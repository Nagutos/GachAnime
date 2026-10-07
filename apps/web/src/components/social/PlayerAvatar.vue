<script setup lang="ts">
withDefaults(defineProps<{ name: string; url: string | null; size?: 'sm' | 'lg' }>(), {
  size: 'sm',
})
</script>

<template>
  <img
    v-if="url"
    :src="url"
    alt=""
    referrerpolicy="no-referrer"
    class="shrink-0 rounded-full bg-night-800 object-cover"
    :class="size === 'lg' ? 'size-20' : 'size-8'"
  />
  <span
    v-else
    class="flex shrink-0 items-center justify-center rounded-full bg-sakura-500/30 font-bold text-sakura-400"
    :class="size === 'lg' ? 'size-20 text-3xl' : 'size-8 text-sm'"
    aria-hidden="true"
  >
    {{ name.charAt(0).toUpperCase() }}
  </span>
</template>
