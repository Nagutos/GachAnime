<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ owned: number; unlocked: number; total: number }>()
const { t, n } = useI18n()
const ratio = computed(() => (props.total ? props.owned / props.total : 0))
</script>

<template>
  <div class="flex flex-col gap-1 text-xs text-mist-300">
    <div class="flex justify-between gap-2">
      <span class="tabular-nums">
        {{ t('wiki.progress', { owned: n(owned, 'integer'), total: n(total, 'integer') }) }}
      </span>
      <span class="tabular-nums">{{ n(ratio, 'percent') }}</span>
    </div>
    <div
      class="h-1.5 overflow-hidden rounded-full bg-night-700"
      role="progressbar"
      :aria-valuenow="owned"
      :aria-valuemin="0"
      :aria-valuemax="total"
      :aria-label="t('wiki.progressLabel')"
    >
      <div
        class="h-full rounded-full"
        :class="ratio >= 1 ? 'bg-gold-400' : 'bg-sakura-400'"
        :style="{ width: `${ratio * 100}%` }"
      />
    </div>
    <span v-if="unlocked > owned">{{ t('wiki.unlocked', { count: n(unlocked, 'integer') }) }}</span>
  </div>
</template>
