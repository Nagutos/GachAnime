<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseAniListDescription } from '@/app/anilist-text'

const props = defineProps<{ text: string | null }>()
const { t } = useI18n()
const blocks = computed(() => parseAniListDescription(props.text))
const shown = ref(new Set<number>())

function show(index: number): void {
  shown.value = new Set(shown.value).add(index)
}
</script>

<template>
  <div class="flex flex-col gap-3 leading-relaxed text-mist-100/90">
    <template v-for="(block, index) in blocks" :key="index">
      <div v-if="block.spoiler && !shown.has(index)">
        <button
          type="button"
          class="rounded-lg border border-dashed border-night-500 px-3 py-1.5 text-sm text-mist-300 hover:border-sakura-400 hover:text-mist-100"
          @click="show(index)"
        >
          {{ t('wiki.showSpoiler') }}
        </button>
      </div>
      <div v-else :class="{ 'border-l-2 border-sakura-400/50 pl-3': block.spoiler }">
        <p v-for="(paragraph, i) in block.paragraphs" :key="i" class="whitespace-pre-line">
          {{ paragraph }}
        </p>
      </div>
    </template>
    <p v-if="blocks.length === 0" class="text-mist-300">{{ t('wiki.noDescription') }}</p>
  </div>
</template>
