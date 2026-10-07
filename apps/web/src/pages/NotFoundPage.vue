<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const { t } = useI18n()
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
    <p class="font-display text-6xl font-extrabold text-sakura-400">404</p>
    <h1 class="text-xl">{{ t('notFound.title') }}</h1>
    <RouterLink to="/" class="text-gold-400 underline">{{ t('notFound.back') }}</RouterLink>
  </main>
</template>
