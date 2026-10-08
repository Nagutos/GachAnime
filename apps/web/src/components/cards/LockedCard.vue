<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerRarities } from '@/app/rarities'
import { rarityStyle } from './rarity-styles'

const props = defineProps<{ rarityKey: string }>()
const { t } = useI18n()
const { nameOf } = usePlayerRarities()
const style = computed(() => rarityStyle(props.rarityKey))
</script>

<template>
  <!-- Same frame as a character card, in a neutral metal: the rarity shows on the dashed edge -->
  <div
    class="card-frame relative aspect-5/7 w-full overflow-hidden rounded-xl p-[5px]"
    style="--frame: var(--color-night-500)"
    data-testid="locked-card"
  >
    <div
      class="card-window relative flex size-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-night-900"
      :class="style.frame"
    >
      <svg viewBox="0 0 100 120" class="w-2/3 fill-night-700" aria-hidden="true">
        <circle cx="50" cy="38" r="22" />
        <path d="M8 120c0-30 18-48 42-48s42 18 42 48z" />
      </svg>
      <p class="mt-2 font-display text-2xl font-bold text-mist-300/60">
        {{ t('wiki.unknownName') }}
      </p>
      <span
        class="absolute top-1.5 left-1.5 rounded-full bg-night-950/85 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase opacity-70"
        :class="style.text"
      >
        {{ nameOf(rarityKey) }}
      </span>
    </div>
  </div>
</template>
