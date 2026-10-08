<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ChevronIcon from '@/components/ChevronIcon.vue'
import { pageItems } from '@/components/pagination'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
const { t, n } = useI18n()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const items = computed(() => pageItems(props.page, pages.value))

const square =
  'inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium tabular-nums transition'
const arrow = `${square} border border-night-700 bg-night-900 text-mist-100 hover:border-sakura-400 hover:text-sakura-400 disabled:pointer-events-none disabled:opacity-30`
</script>

<template>
  <nav
    v-if="pages > 1"
    class="flex items-center justify-center gap-1 text-mist-300"
    :aria-label="t('common.pagination')"
  >
    <button
      type="button"
      :class="arrow"
      :disabled="page <= 1"
      :aria-label="t('common.previous')"
      @click="emit('update:page', page - 1)"
    >
      <ChevronIcon direction="left" />
    </button>
    <template v-for="(item, index) in items" :key="item ?? `gap-${index}`">
      <span v-if="item === null" class="flex w-6 justify-center max-sm:hidden" aria-hidden="true">
        <svg viewBox="0 0 20 4" class="h-1 w-4 fill-current">
          <circle cx="2" cy="2" r="1.6" />
          <circle cx="10" cy="2" r="1.6" />
          <circle cx="18" cy="2" r="1.6" />
        </svg>
      </span>
      <button
        v-else
        type="button"
        :class="[
          square,
          'max-sm:hidden',
          item === page ? 'bg-sakura-600 text-white' : 'hover:bg-night-800 hover:text-mist-100',
        ]"
        :aria-label="t('common.goToPage', { page: n(item, 'integer') })"
        :aria-current="item === page ? 'page' : undefined"
        @click="item !== page && emit('update:page', item)"
      >
        {{ n(item, 'integer') }}
      </button>
    </template>
    <span class="px-2 text-sm sm:hidden">
      {{ t('common.pageOf', { page: n(page, 'integer'), pages: n(pages, 'integer') }) }}
    </span>
    <button
      type="button"
      :class="arrow"
      :disabled="page >= pages"
      :aria-label="t('common.next')"
      @click="emit('update:page', page + 1)"
    >
      <ChevronIcon direction="right" />
    </button>
  </nav>
</template>
