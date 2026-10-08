<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PACK_COLOR_PRESETS as PRESETS } from '../pack-colors'

const color = defineModel<string>({ required: true })
/** Colors of the other packs, by color: their names (the picker flags colors already taken). */
const props = defineProps<{ used: ReadonlyMap<string, string[]> }>()
const { t } = useI18n()

const takenBy = computed(() => props.used.get(color.value) ?? [])
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      class="flex flex-wrap items-center gap-2"
      role="radiogroup"
      :aria-label="t('admin.themes.color')"
    >
      <button
        v-for="preset in PRESETS"
        :key="preset"
        type="button"
        role="radio"
        :aria-checked="color === preset"
        :aria-label="preset"
        :title="used.get(preset)?.join(', ') ?? preset"
        class="relative size-8 rounded-full ring-offset-2 ring-offset-night-900 transition hover:scale-110"
        :class="color === preset ? 'ring-2 ring-mist-100' : ''"
        :style="{ backgroundColor: preset }"
        @click="color = preset"
      >
        <span
          v-if="used.has(preset)"
          class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-night-900 bg-mist-100"
          aria-hidden="true"
        />
      </button>
      <label
        class="relative flex size-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-night-500 hover:border-mist-300"
        :title="t('admin.themes.customColor')"
      >
        <span class="sr-only">{{ t('admin.themes.customColor') }}</span>
        <svg viewBox="0 0 20 20" class="size-4 text-mist-300" aria-hidden="true">
          <path
            d="M10 4v12M4 10h12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <input v-model="color" type="color" class="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <span class="font-mono text-xs text-mist-300 uppercase">{{ color }}</span>
    </div>
    <p v-if="takenBy.length" class="text-xs text-gold-400" data-testid="pack-color-taken">
      {{ t('admin.themes.colorTaken', { packs: takenBy.join(', ') }) }}
    </p>
  </div>
</template>
