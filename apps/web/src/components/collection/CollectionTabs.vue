<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const { t } = useI18n()
const tabs = [
  { name: 'collection', label: 'collection.tabs.cards' },
  { name: 'collection-series', label: 'collection.tabs.series' },
] as const
</script>

<template>
  <nav class="flex gap-1 border-b border-night-700" :aria-label="t('collection.title')">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.name"
      :to="{ name: tab.name }"
      class="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-mist-300 hover:text-mist-100"
      exact-active-class="border-sakura-400! text-mist-100!"
    >
      {{ t(tab.label) }}
    </RouterLink>
  </nav>
</template>
