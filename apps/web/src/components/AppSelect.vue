<script setup lang="ts" generic="M extends string | string[]">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
import { computed } from 'vue'
import ChevronIcon from '@/components/ChevronIcon.vue'

export interface SelectOption<V extends string = string> {
  value: V
  label: string
  disabled?: boolean
}

/**
 * Dropdown styled like the rest of the site (Reka UI select). Attributes (class, aria-label,
 * data-testid) go to the trigger button. `multiple` takes and emits an array of values.
 */
defineOptions({ inheritAttrs: false })

/** The value of one option: the model itself, or an element of it with `multiple`. */
type Item = M extends (infer V)[] ? V : M

const props = defineProps<{
  options: readonly SelectOption<Item & string>[]
  disabled?: boolean
  multiple?: boolean
  /** Shown when nothing is selected (multiple mode). */
  placeholder?: string
  /** Borderless trigger, for selects placed inside another control. */
  ghost?: boolean
}>()
const model = defineModel<M>({ required: true })

/** Reka reserves the empty string (cleared select): an "all" option `''` is mapped to this. */
const EMPTY = '\u0000empty'
const toInner = (value: string) => (value === '' ? EMPTY : value)
const toOuter = (value: string) => (value === EMPTY ? '' : value)

const inner = computed({
  get: () => (Array.isArray(model.value) ? model.value.map(toInner) : toInner(model.value)),
  set: (value: string | string[]) => {
    model.value = (Array.isArray(value) ? value.map(toOuter) : toOuter(value)) as M
  },
})

const selectedLabel = computed(() => {
  const values = new Set<string>(Array.isArray(model.value) ? model.value : [model.value])
  const labels = props.options.filter((option) => values.has(option.value)).map((o) => o.label)
  return labels.join(', ')
})
</script>

<template>
  <SelectRoot v-model="inner" :disabled="disabled" :multiple="multiple">
    <SelectTrigger
      v-bind="$attrs"
      class="group/select inline-flex min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-mist-100 transition outline-none focus-visible:ring-2 focus-visible:ring-sakura-400/60 disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        ghost
          ? 'bg-transparent hover:bg-night-800'
          : 'border border-night-700 bg-night-950 hover:border-night-500 data-[state=open]:border-sakura-400'
      "
    >
      <SelectValue :placeholder="placeholder" class="truncate">
        {{ selectedLabel || placeholder }}
      </SelectValue>
      <ChevronIcon
        direction="down"
        class="text-mist-300 transition-transform group-data-[state=open]/select:rotate-180"
      />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="6"
        class="select-pop z-50 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-night-700 bg-night-900 p-1 text-sm text-mist-100 shadow-xl"
      >
        <SelectViewport class="max-h-80">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="toInner(option.value)"
            :disabled="option.disabled"
            class="relative flex cursor-pointer items-center rounded-lg py-2 pr-3 pl-8 outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-40 data-highlighted:bg-night-800 data-[state=checked]:text-sakura-400"
          >
            <SelectItemIndicator class="absolute left-2.5 inline-flex">
              <svg viewBox="0 0 20 20" aria-hidden="true" class="size-4">
                <path
                  d="m4.5 10.5 3.5 3.5 7.5-8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </SelectItemIndicator>
            <SelectItemText>{{ option.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
