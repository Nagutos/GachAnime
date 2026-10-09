<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ChevronIcon from '@/components/ChevronIcon.vue'
import { pageItems, parsePageInput } from '@/components/pagination'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
const { t, n } = useI18n()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const items = computed(() => pageItems(props.page, pages.value))

/** A gap (…) turns into a "go to page" field when clicked; `jumpAt` is its index. */
const jumpAt = ref<number | null>(null)
const jumpInput = ref<HTMLInputElement[]>([])
async function openJump(index: number): Promise<void> {
  jumpAt.value = index
  await nextTick()
  jumpInput.value[0]?.focus()
}

/** Goes to the typed page (Enter, blur or the phone field); anything else is ignored. */
function jumpTo(value: string): void {
  jumpAt.value = null
  const target = parsePageInput(value, pages.value)
  if (target !== null && target !== props.page) emit('update:page', target)
}

/** Enter then blur (the field disappears) must not jump twice. */
function commitJump(value: string): void {
  if (jumpAt.value !== null) jumpTo(value)
}

function onPhoneChange(event: Event): void {
  const input = event.target as HTMLInputElement
  jumpTo(input.value)
  // Not a number, or the same page: show the current page again.
  input.value = String(props.page)
}

const square =
  'inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium tabular-nums transition'
const arrow = `${square} border border-night-700 bg-night-900 text-mist-100 hover:border-sakura-400 hover:text-sakura-400 disabled:pointer-events-none disabled:opacity-30`
const field =
  'h-9 rounded-lg border border-night-700 bg-night-900 text-center text-sm text-mist-100 tabular-nums outline-none focus:border-sakura-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
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
      <template v-if="item === null">
        <input
          v-if="jumpAt === index"
          ref="jumpInput"
          type="number"
          inputmode="numeric"
          min="1"
          :max="pages"
          :placeholder="t('common.pageShort')"
          :class="[field, 'w-14 max-sm:hidden']"
          :aria-label="t('common.jumpToPage', { pages: n(pages, 'integer') })"
          data-testid="page-jump"
          @keydown.enter.prevent="commitJump(($event.target as HTMLInputElement).value)"
          @keydown.esc.prevent="jumpAt = null"
          @blur="commitJump(($event.target as HTMLInputElement).value)"
        />
        <button
          v-else
          type="button"
          :class="[square, 'w-9 hover:bg-night-800 hover:text-mist-100 max-sm:hidden']"
          :aria-label="t('common.jumpToPage', { pages: n(pages, 'integer') })"
          :title="t('common.jumpToPage', { pages: n(pages, 'integer') })"
          data-testid="page-gap"
          @click="openJump(index)"
        >
          <svg viewBox="0 0 20 4" class="h-1 w-4 fill-current" aria-hidden="true">
            <circle cx="2" cy="2" r="1.6" />
            <circle cx="10" cy="2" r="1.6" />
            <circle cx="18" cy="2" r="1.6" />
          </svg>
        </button>
      </template>
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
    <!-- Phones: "Page [3] / 12", the number can be typed -->
    <label class="flex items-center gap-1.5 px-1 text-sm sm:hidden">
      {{ t('common.pageShort') }}
      <input
        :key="page"
        type="number"
        inputmode="numeric"
        min="1"
        :max="pages"
        :value="page"
        :class="[field, 'w-14']"
        :aria-label="t('common.jumpToPage', { pages: n(pages, 'integer') })"
        data-testid="page-input"
        @change="onPhoneChange"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
      />
      / {{ n(pages, 'integer') }}
    </label>
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
