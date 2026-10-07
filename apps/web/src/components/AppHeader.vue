<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useSession } from '@/app/session'
import BrandMark from './BrandMark.vue'
import LocaleSwitcher from './LocaleSwitcher.vue'
import UserMenu from './UserMenu.vue'

const { me, changeLocale, signOut } = useSession()
</script>

<template>
  <header class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
    <RouterLink to="/"><BrandMark /></RouterLink>
    <div class="flex items-center gap-3">
      <LocaleSwitcher @change="changeLocale" />
      <UserMenu v-if="me" :me="me" @sign-out="signOut" />
    </div>
  </header>
</template>
