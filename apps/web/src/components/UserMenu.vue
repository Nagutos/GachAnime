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

defineProps<{ me: MeResponse }>()
const emit = defineEmits<{ signOut: [] }>()
const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :aria-label="t('auth.accountMenu')"
      class="flex items-center gap-2 rounded-full border border-night-700 bg-night-900 py-1 pr-3 pl-1"
    >
      <img v-if="me.avatarUrl" :src="me.avatarUrl" alt="" class="size-7 rounded-full" />
      <span class="text-sm font-medium">{{ me.displayName }}</span>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="min-w-40 rounded-xl border border-night-700 bg-night-900 p-1 text-sm shadow-xl"
      >
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
          data-testid="feedback-link"
          @select="router.push({ name: 'feedback' })"
        >
          {{ t('feedback.menu') }}
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
