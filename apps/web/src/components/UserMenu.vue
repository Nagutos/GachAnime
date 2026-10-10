<script setup lang="ts">
import type { MeResponse } from '@gachanime/shared'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

/** `claimableAchievements`: shown on the menu button and next to its Achievements item. */
withDefaults(defineProps<{ me: MeResponse; claimableAchievements?: number }>(), {
  claimableAchievements: 0,
})
const emit = defineEmits<{ signOut: [] }>()
const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :aria-label="
        claimableAchievements
          ? `${t('auth.accountMenu')} · ${t('nav.claimable', { count: claimableAchievements })}`
          : t('auth.accountMenu')
      "
      class="relative flex items-center gap-2 rounded-full border border-night-700 bg-night-900 py-1 pr-3 pl-1"
      data-testid="user-menu"
    >
      <img v-if="me.avatarUrl" :src="me.avatarUrl" alt="" class="size-7 rounded-full" />
      <span class="text-sm font-medium">{{ me.displayName }}</span>
      <span
        v-if="claimableAchievements"
        class="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-xs leading-none font-bold text-night-950"
        aria-hidden="true"
        data-testid="badge-user-menu"
      >
        {{ claimableAchievements }}
      </span>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="min-w-40 rounded-xl border border-night-700 bg-night-900 p-1 text-sm shadow-xl"
      >
        <DropdownMenuItem
          class="cursor-pointer rounded-lg px-3 py-2 outline-none data-highlighted:bg-night-800"
          data-testid="profile-link"
          @select="router.push({ name: 'profile', params: { username: me.username } })"
        >
          {{ t('nav.myProfile') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          class="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 outline-none data-highlighted:bg-night-800"
          data-testid="nav-achievements"
          @select="router.push({ name: 'achievements' })"
        >
          {{ t('nav.achievements') }}
          <span
            v-if="claimableAchievements"
            class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-xs leading-none font-bold text-night-950"
            :aria-label="t('nav.claimable', { count: claimableAchievements })"
            data-testid="badge-achievements"
          >
            {{ claimableAchievements }}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="cursor-pointer rounded-lg px-3 py-2 outline-none data-highlighted:bg-night-800"
          data-testid="wishlist-link"
          @select="router.push({ name: 'collection-wishlist' })"
        >
          {{ t('nav.myWishlist') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          class="cursor-pointer rounded-lg px-3 py-2 outline-none data-highlighted:bg-night-800"
          @select="router.push({ name: 'players' })"
        >
          {{ t('nav.players') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="me.role === 'admin'"
          class="cursor-pointer rounded-lg px-3 py-2 outline-none data-highlighted:bg-night-800"
          data-testid="admin-link"
          @select="router.push({ name: 'admin' })"
        >
          {{ t('admin.openAdmin') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          class="cursor-pointer rounded-lg px-3 py-2 outline-none data-highlighted:bg-night-800"
          @select="emit('signOut')"
        >
          {{ t('auth.signOut') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
