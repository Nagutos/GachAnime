<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  progress: number
  target: number
  /** Accessible name of the progress bar (the objective's name). */
  label: string
  done?: boolean
  percent?: boolean
}>()
const { t, n } = useI18n()
const ratio = computed(() => Math.min(1, props.target ? props.progress / props.target : 0))
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      class="h-2 overflow-hidden rounded-full bg-night-700"
      role="progressbar"
      :aria-valuenow="progress"
      :aria-valuemin="0"
      :aria-valuemax="target"
      :aria-label="label"
    >
      <div
        class="h-full rounded-full transition-all"
        :class="done ? 'bg-gold-400' : 'bg-sakura-400'"
        :style="{ width: `${ratio * 100}%` }"
      />
    </div>
    <span class="text-xs text-mist-300 tabular-nums">
      {{
        percent
          ? t('progression.percentProgress', {
              progress: n(progress, 'integer'),
              target: n(target, 'integer'),
            })
          : t('progression.progress', {
              progress: n(progress, 'integer'),
              target: n(target, 'integer'),
            })
      }}
    </span>
  </div>
</template>
