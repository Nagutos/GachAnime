<script setup lang="ts">
import { watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'
import { pageTitleKey } from '@/app/page-title'
import AppHeader from '@/components/AppHeader.vue'
import ToastHost from '@/components/ToastHost.vue'

const { t } = useI18n()
const route = useRoute()

watchEffect(() => {
  const key = pageTitleKey(route.name?.toString())
  const appName = t('app.name')
  document.title = key ? `${t(key)} · ${appName}` : appName
})
</script>

<template>
  <a
    href="#content"
    class="sr-only z-50 rounded-lg bg-night-800 px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
  >
    {{ t('nav.skipToContent') }}
  </a>
  <AppHeader />
  <div id="content" tabindex="-1" class="outline-none">
    <RouterView />
  </div>
  <ToastHost />
</template>
