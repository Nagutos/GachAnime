<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SealMark from '@/components/SealMark.vue'

/** Printed side of a pack (rendered once per piece when the pack is torn). */
defineProps<{
  label: string
  cards: number
  art: string
  seal: string
  /** Pack color (`#rrggbb`), overriding the art token's. */
  color?: string | null
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="pack-foil absolute inset-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]"
    :class="`pack-art-${art}`"
    :style="color ? { '--pack-color': color } : undefined"
  >
    <div class="pack-sheen absolute" />
    <!-- Heat-sealed bands, inside the serrated edges -->
    <div class="pack-crimp absolute inset-x-0 top-[2.5%] h-[7%] opacity-70" />
    <div class="pack-crimp absolute inset-x-0 bottom-[2.5%] h-[5%] opacity-70" />
    <div
      class="absolute inset-x-0 top-[14%] bottom-[8%] flex flex-col items-center justify-center gap-3 p-4 text-center"
    >
      <SealMark :glyph="seal" class="size-16 text-(--pack-seal) drop-shadow-lg" />
      <p class="font-display text-xl leading-tight font-extrabold text-white drop-shadow">
        {{ label }}
      </p>
      <p class="rounded-full bg-night-950/50 px-3 py-0.5 text-xs text-mist-100">
        {{ t('boosters.cardsPerPack', { count: cards }) }}
      </p>
    </div>
  </div>
</template>
