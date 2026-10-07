<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
const { t, n } = useI18n()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const button =
  'rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm font-medium transition hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-40'
</script>

<template>
  <nav
    v-if="pages > 1"
    class="flex items-center justify-center gap-3 text-sm text-mist-300"
    :aria-label="t('common.pagination')"
  >
    <button
      type="button"
      :class="button"
      :disabled="page <= 1"
      @click="emit('update:page', page - 1)"
    >
      {{ t('common.previous') }}
    </button>
    <span>{{ t('common.pageOf', { page: n(page, 'integer'), pages: n(pages, 'integer') }) }}</span>
    <button
      type="button"
      :class="button"
      :disabled="page >= pages"
      @click="emit('update:page', page + 1)"
    >
      {{ t('common.next') }}
    </button>
  </nav>
</template>
