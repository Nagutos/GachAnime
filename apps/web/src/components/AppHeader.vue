<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useSession } from '@/app/session'
import BrandMark from './BrandMark.vue'
import LocaleSwitcher from './LocaleSwitcher.vue'
import UserMenu from './UserMenu.vue'

const { t, n } = useI18n()
const { me, changeLocale, signOut } = useSession()

const links = [
  { name: 'boosters', label: 'nav.boosters' },
  { name: 'collection', label: 'nav.collection' },
  { name: 'wiki', label: 'nav.wiki' },
] as const
</script>

<template>
  <header
    class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4"
  >
    <RouterLink to="/"><BrandMark /></RouterLink>
    <nav
      v-if="me"
      class="order-last flex w-full gap-1 overflow-x-auto sm:order-0 sm:w-auto sm:flex-1"
      :aria-label="t('nav.main')"
    >
      <RouterLink
        v-for="link in links"
        :key="link.name"
        :to="{ name: link.name }"
        class="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-mist-300 transition hover:bg-night-800 hover:text-mist-100"
        :class="{
          'bg-night-800 text-mist-100': $route.name?.toString().startsWith(link.name),
        }"
        :data-testid="`nav-${link.name}`"
      >
        {{ t(link.label) }}
      </RouterLink>
    </nav>
    <div class="flex items-center gap-3">
      <RouterLink
        v-if="me"
        :to="{ name: 'gems' }"
        class="hidden rounded-full bg-night-800 px-3 py-1 text-sm text-gold-400 tabular-nums hover:bg-night-700 sm:inline"
        :title="t('home.gemBalance')"
        data-testid="header-gems"
      >
        {{ t('nav.gems', { count: n(me.gemBalance, 'integer') }) }}
      </RouterLink>
      <LocaleSwitcher @change="changeLocale" />
      <UserMenu v-if="me" :me="me" @sign-out="signOut" />
    </div>
  </header>
</template>
