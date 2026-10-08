<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppSelect from '@/components/AppSelect.vue'
import { availableLocales } from '@/locales'

const emit = defineEmits<{ change: [locale: string] }>()
const { t, locale } = useI18n()

/** Messages are precompiled by Vite: read them through `t`, never as raw objects. */
function nativeName(code: string): string {
  return t('meta.nativeName', {}, { locale: code })
}
</script>

<template>
  <AppSelect
    :model-value="locale"
    :options="availableLocales.map((code) => ({ value: code, label: nativeName(code) }))"
    :aria-label="t('common.language')"
    data-testid="locale-switcher"
    @update:model-value="emit('change', $event as string)"
  />
</template>
