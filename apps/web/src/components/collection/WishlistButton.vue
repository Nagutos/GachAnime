<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useWishlistMutation } from '@/api/player'

const props = defineProps<{ characterId: number; wishlisted: boolean; large?: boolean }>()
const { t } = useI18n()
const mutation = useWishlistMutation()

function toggle(): void {
  mutation.mutate({ characterId: props.characterId, wishlisted: !props.wishlisted })
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center justify-center gap-2 rounded-full border transition disabled:opacity-50"
    :class="[
      wishlisted
        ? 'border-sakura-400 bg-sakura-500/90 text-white'
        : 'border-night-500 bg-night-950/80 text-mist-300 hover:text-sakura-400',
      large ? 'px-4 py-2 text-sm font-semibold' : 'size-8',
    ]"
    :aria-pressed="wishlisted"
    :aria-label="wishlisted ? t('wishlist.remove') : t('wishlist.add')"
    :title="wishlisted ? t('wishlist.remove') : t('wishlist.add')"
    :disabled="mutation.isPending.value"
    data-testid="wishlist-button"
    @click.prevent.stop="toggle"
  >
    <svg
      viewBox="0 0 24 24"
      class="size-4"
      :class="wishlisted ? 'fill-current' : 'fill-none'"
      aria-hidden="true"
    >
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z"
        class="stroke-current stroke-2"
      />
    </svg>
    <span v-if="large">{{ wishlisted ? t('wishlist.inWishlist') : t('wishlist.add') }}</span>
  </button>
</template>
