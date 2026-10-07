<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { availableLocales } from '@/locales'

const emit = defineEmits<{ change: [locale: string] }>()
const { t, locale } = useI18n()

/** Messages are precompiled by Vite: read them through `t`, never as raw objects. */
function nativeName(code: string): string {
  return t('meta.nativeName', {}, { locale: code })
}

function onChange(event: Event): void {
  emit('change', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="flex items-center gap-2 text-sm text-mist-300">
    <span class="sr-only">{{ t('common.language') }}</span>
    <select
      :value="locale"
      data-testid="locale-switcher"
      class="rounded-lg border border-night-700 bg-night-900 px-2 py-1 text-mist-100"
      @change="onChange"
    >
      <option v-for="code in availableLocales" :key="code" :value="code">
        {{ nativeName(code) }}
      </option>
    </select>
  </label>
</template>
