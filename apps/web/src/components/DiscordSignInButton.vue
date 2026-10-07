<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { signInWithDiscord } from '@/app/auth'

const { t } = useI18n()
const pending = ref(false)

async function signIn(): Promise<void> {
  pending.value = true
  try {
    await signInWithDiscord()
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <button
    type="button"
    :disabled="pending"
    class="inline-flex items-center gap-2 rounded-xl bg-discord px-5 py-3 font-semibold text-white shadow-lg shadow-discord/30 transition hover:brightness-110 disabled:opacity-60"
    @click="signIn"
  >
    <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 fill-current">
      <path
        d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.6.3 18a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4-2 1 1.3 2a19.8 19.8 0 0 0 6-3c.4-5.1-.8-9.6-3.6-13.6ZM8.7 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm6.6 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z"
      />
    </svg>
    {{ t('auth.signInWithDiscord') }}
  </button>
</template>
