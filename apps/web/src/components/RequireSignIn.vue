<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSession } from '@/app/session'
import DiscordSignInButton from './DiscordSignInButton.vue'

const { t } = useI18n()
const { isPending, isSignedIn, me } = useSession()
</script>

<template>
  <p v-if="isPending || (isSignedIn && !me)" class="py-16 text-center text-mist-300">
    {{ t('common.loading') }}
  </p>
  <div v-else-if="!isSignedIn" class="flex flex-col items-center gap-4 py-24 text-center">
    <p class="text-lg">{{ t('auth.required') }}</p>
    <DiscordSignInButton />
  </div>
  <slot v-else />
</template>
