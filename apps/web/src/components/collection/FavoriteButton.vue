<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFavoriteMutation } from '@/api/player'

const props = defineProps<{ characterId: number; favorite: boolean; large?: boolean }>()
const { t } = useI18n()
const mutation = useFavoriteMutation()

function toggle(): void {
  mutation.mutate({ characterId: props.characterId, favorite: !props.favorite })
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center justify-center gap-2 rounded-full border transition disabled:opacity-50"
    :class="[
      favorite
        ? 'border-gold-400 bg-gold-400 text-night-950'
        : 'border-night-500 bg-night-950/80 text-mist-300 hover:text-gold-400',
      large ? 'px-4 py-2 text-sm font-semibold' : 'size-8',
    ]"
    :aria-pressed="favorite"
    :aria-label="favorite ? t('favorites.remove') : t('favorites.add')"
    :title="favorite ? t('favorites.remove') : t('favorites.add')"
    :disabled="mutation.isPending.value"
    data-testid="favorite-button"
    @click.prevent.stop="toggle"
  >
    <svg
      viewBox="0 0 24 24"
      class="size-4"
      :class="favorite ? 'fill-current' : 'fill-none'"
      aria-hidden="true"
    >
      <path
        d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z"
        class="stroke-current stroke-2"
        stroke-linejoin="round"
      />
    </svg>
    <span v-if="large">{{ favorite ? t('favorites.inFavorites') : t('favorites.add') }}</span>
  </button>
</template>
