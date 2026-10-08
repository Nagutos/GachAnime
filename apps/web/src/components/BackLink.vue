<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import ChevronIcon from '@/components/ChevronIcon.vue'

/** "Back" control at the top of a page: a link, or a button when `to` is absent (history). */
defineProps<{ to?: RouteLocationRaw; label: string }>()
const emit = defineEmits<{ click: [] }>()

const classes =
  'group inline-flex w-fit items-center gap-1.5 self-start rounded-full border border-night-700 bg-night-900/70 py-1.5 pr-4 pl-2.5 text-sm font-medium text-mist-300 transition hover:border-sakura-400/60 hover:text-mist-100'
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="classes">
    <ChevronIcon direction="left" class="transition-transform group-hover:-translate-x-0.5" />
    {{ label }}
  </RouterLink>
  <button v-else type="button" :class="classes" @click="emit('click')">
    <ChevronIcon direction="left" class="transition-transform group-hover:-translate-x-0.5" />
    {{ label }}
  </button>
</template>
