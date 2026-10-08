<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SealMark from '@/components/SealMark.vue'

/** Printed side of a pack. Rendered once per torn piece, each piece clipping its own part. */
defineProps<{ label: string; cards: number; art: string; ribbon: string | null; tearAt: number }>()

const { t } = useI18n()
</script>

<template>
  <div
    class="pack-foil absolute inset-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]"
    :class="`pack-art-${art}`"
  >
    <div class="pack-sheen absolute inset-0" />
    <!-- Heat-sealed bands, inside the serrated edges -->
    <div class="pack-crimp absolute inset-x-0 top-[2.5%] h-[7%] opacity-70" />
    <div class="pack-crimp absolute inset-x-0 bottom-[2.5%] h-[5%] opacity-70" />
    <!-- Dotted guide just above the tear line -->
    <div
      class="absolute inset-x-[6%] border-t border-dashed border-white/35"
      :style="{ top: `${tearAt - 1.6}%` }"
    />
    <div
      class="absolute inset-x-0 top-[14%] bottom-[8%] flex flex-col items-center justify-center gap-3 p-4 text-center"
    >
      <SealMark class="size-16 text-(--pack-seal) drop-shadow-lg" />
      <p class="font-display text-xl font-extrabold text-white drop-shadow">{{ label }}</p>
      <p
        v-if="ribbon"
        class="w-full bg-night-950/70 py-1 text-sm font-bold tracking-wide text-gold-400 uppercase"
      >
        {{ ribbon }}
      </p>
      <p v-else class="rounded-full bg-night-950/50 px-3 py-0.5 text-xs text-mist-100">
        {{ t('boosters.cardsPerPack', { count: cards }) }}
      </p>
    </div>
  </div>
</template>
