<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView } from 'vue-router'
import { useSession } from '@/app/session'

const { t } = useI18n()
const { isPending, isSignedIn, me } = useSession()

const links = [
  { name: 'admin', label: 'admin.nav.dashboard' },
  { name: 'admin-series', label: 'admin.nav.series' },
  { name: 'admin-characters', label: 'admin.nav.characters' },
  { name: 'admin-imports', label: 'admin.nav.imports' },
  { name: 'admin-boosters', label: 'admin.nav.boosters' },
  { name: 'admin-themes', label: 'admin.nav.themes' },
  { name: 'admin-rarities', label: 'admin.nav.rarities' },
  { name: 'admin-settings', label: 'admin.nav.settings' },
  { name: 'admin-missions', label: 'admin.nav.missions' },
  { name: 'admin-achievements', label: 'admin.nav.achievements' },
  { name: 'admin-feedback', label: 'admin.nav.feedback' },
  { name: 'admin-audit', label: 'admin.nav.audit' },
] as const
</script>

<template>
  <div class="mx-auto w-full max-w-7xl px-4 pb-16">
    <p v-if="isPending || (isSignedIn && !me)" class="py-16 text-center text-mist-300">
      {{ t('common.loading') }}
    </p>
    <div
      v-else-if="me?.role !== 'admin'"
      class="flex flex-col items-center gap-4 py-24 text-center"
    >
      <p class="text-lg">{{ t('admin.forbidden') }}</p>
      <RouterLink to="/" class="text-gold-400 underline">{{ t('notFound.back') }}</RouterLink>
    </div>
    <div v-else class="flex flex-col gap-6 lg:flex-row">
      <nav
        class="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col"
        :aria-label="t('admin.title')"
      >
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          class="rounded-lg px-3 py-2 text-sm whitespace-nowrap text-mist-300 transition hover:bg-night-800 hover:text-mist-100"
          exact-active-class="bg-night-800 text-mist-100 font-semibold"
          :class="{
            'bg-night-800 text-mist-100 font-semibold':
              link.name !== 'admin' && $route.name?.toString().startsWith(link.name),
          }"
        >
          {{ t(link.label) }}
        </RouterLink>
      </nav>
      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
