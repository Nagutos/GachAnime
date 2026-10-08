<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PaginationBar from '@/components/PaginationBar.vue'

defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
const { t, n } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-mist-300">
    <span>{{ t('admin.common.results', { count: n(total, 'integer') }, total) }}</span>
    <PaginationBar
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="emit('update:page', $event)"
    />
  </div>
</template>
