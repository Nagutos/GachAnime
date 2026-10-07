<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ui } from '../ui'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
const { t, n } = useI18n()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-mist-300">
    <span>{{ t('admin.common.results', { count: n(total, 'integer') }, total) }}</span>
    <div class="flex items-center gap-2">
      <button
        type="button"
        :class="ui.button"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        {{ t('admin.common.previous') }}
      </button>
      <span>{{
        t('admin.common.pageOf', { page: n(page, 'integer'), pages: n(pages, 'integer') })
      }}</span>
      <button
        type="button"
        :class="ui.button"
        :disabled="page >= pages"
        @click="emit('update:page', page + 1)"
      >
        {{ t('admin.common.next') }}
      </button>
    </div>
  </div>
</template>
