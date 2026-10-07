<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

defineProps<{ title: string; description?: string; wide?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-night-950/80 backdrop-blur-sm" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border border-night-700 bg-night-900 p-6 shadow-2xl"
        :class="wide ? 'max-w-3xl' : 'max-w-lg'"
      >
        <div class="flex items-start justify-between gap-4">
          <DialogTitle class="font-display text-xl font-bold">{{ title }}</DialogTitle>
          <DialogClose
            class="rounded-lg px-2 text-2xl leading-none text-mist-300 hover:text-mist-100"
            :aria-label="t('common.close')"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-5 fill-none stroke-current stroke-2"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </DialogClose>
        </div>
        <DialogDescription v-if="description" class="text-sm text-mist-300">
          {{ description }}
        </DialogDescription>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
