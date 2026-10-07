<script setup lang="ts">
import type { WikiSeriesItem } from '@gachanime/shared'
import { RouterLink } from 'vue-router'
import SeriesProgress from './SeriesProgress.vue'

defineProps<{ series: WikiSeriesItem }>()
</script>

<template>
  <RouterLink
    :to="{ name: 'wiki-series', params: { id: series.id } }"
    class="group flex h-full flex-col overflow-hidden rounded-2xl border border-night-700 bg-night-900/70 transition hover:-translate-y-1 hover:border-sakura-400/60"
    :class="{ 'border-gold-400/70': series.ownedCount === series.characterCount }"
  >
    <div class="relative aspect-16/9 overflow-hidden bg-night-800">
      <img
        v-if="series.coverUrl"
        :src="series.coverUrl"
        alt=""
        loading="lazy"
        referrerpolicy="no-referrer"
        class="size-full object-cover opacity-80 transition group-hover:opacity-100"
      />
    </div>
    <div class="flex flex-1 flex-col gap-2 p-3">
      <p class="line-clamp-2 leading-tight font-semibold">{{ series.title }}</p>
      <SeriesProgress
        class="mt-auto"
        :owned="series.ownedCount"
        :unlocked="series.unlockedCount"
        :total="series.characterCount"
      />
    </div>
  </RouterLink>
</template>
