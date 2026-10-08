<script setup lang="ts">
import { computed } from 'vue'
import { SEAL_GLYPHS } from './seal-glyphs'

/**
 * A seal with a kanji: 招 (the GachAnime logo, same artwork as `/favicon.svg`) or a pack's own
 * kanji. The seal takes `currentColor` (or the `color` prop), the kanji stays light. Kanji
 * without a built-in outline (`seal-glyphs.ts`) are drawn as text in a serif CJK font.
 */
const props = withDefaults(defineProps<{ color?: string; glyph?: string }>(), {
  color: undefined,
  glyph: '招',
})
const outline = computed(() => SEAL_GLYPHS[props.glyph] ?? null)
</script>

<template>
  <svg viewBox="0 0 64 64" aria-hidden="true" :style="color ? { color } : undefined">
    <rect x="2" y="2" width="60" height="60" rx="14" fill="currentColor" />
    <rect
      x="6"
      y="6"
      width="52"
      height="52"
      rx="10"
      fill="none"
      stroke="#f4f1ff"
      stroke-opacity="0.55"
      stroke-width="1.5"
    />
    <path v-if="outline" fill="#f4f1ff" :d="outline" />
    <text
      v-else
      x="32"
      y="33"
      fill="#f4f1ff"
      font-size="38"
      font-weight="700"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="'Noto Serif CJK JP', 'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif"
    >
      {{ glyph }}
    </text>
  </svg>
</template>
