<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <span class="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight">
    <img src="/favicon.svg" alt="" class="size-8" />
    <span>{{ t('app.name') }}</span>
  </span>
</template>
