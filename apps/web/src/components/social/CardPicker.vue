<script setup lang="ts">
import type { PlayerCard } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerCardsQuery } from '@/api/social'
import { usePlayerRarities } from '@/app/rarities'
import AppSelect from '@/components/AppSelect.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import { rarityStyle } from '@/components/cards/rarity-styles'
import { playerUi } from '@/components/ui'

/**
 * Picks tradable cards of a player. `wishedLabel` names the badge for cards in the viewer's
 * wishlist (the API reports the wishlist of the viewer = the other side of the trade).
 */
const PAGE_SIZE = 24
const props = defineProps<{ username: string; wishedLabel: string; testId: string }>()
const emit = defineEmits<{ pick: [card: PlayerCard] }>()
const { t } = useI18n()
const { filterOptions: rarityOptions } = usePlayerRarities()
const search = ref('')
const debounced = refDebounced(search, 300)
const rarity = ref('')
const wishedOnly = ref(false)
const page = ref(1)
watch([debounced, rarity, wishedOnly], () => (page.value = 1))
const cards = usePlayerCardsQuery(
  () => props.username,
  computed(() => ({
    page: page.value,
    pageSize: PAGE_SIZE,
    tradable: 'true' as const,
    search: debounced.value || undefined,
    rarity: rarity.value || undefined,
    viewerWishlist: wishedOnly.value ? ('true' as const) : undefined,
  })),
)
const data = computed(() => cards.data.value)
</script>

<template>
  <div class="flex flex-col gap-2" :data-testid="testId">
    <div class="flex flex-wrap gap-2">
      <input
        v-model="search"
        type="search"
        :class="[playerUi.input, 'min-w-32 flex-1']"
        :placeholder="t('collection.searchPlaceholder')"
        :aria-label="t('collection.searchPlaceholder')"
      />
      <AppSelect v-model="rarity" :options="rarityOptions" :aria-label="t('collection.rarity')" />
      <label class="flex items-center gap-1 text-sm text-mist-300">
        <input v-model="wishedOnly" type="checkbox" class="accent-sakura-500" />
        {{ wishedLabel }}
      </label>
    </div>
    <ul class="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
      <li v-for="card in data?.items ?? []" :key="card.id">
        <button
          type="button"
          class="relative block w-full overflow-hidden rounded-lg border-2 text-left transition hover:-translate-y-0.5"
          :class="rarityStyle(card.rarityKey).frame"
          :title="card.name"
          :data-testid="`pick-${card.id}`"
          @click="emit('pick', card)"
        >
          <img
            v-if="card.imageUrl"
            :src="card.imageUrl"
            :alt="card.name"
            referrerpolicy="no-referrer"
            class="aspect-5/7 w-full object-cover"
          />
          <span v-else class="flex aspect-5/7 items-center justify-center bg-night-800 text-xs">
            {{ card.name }}
          </span>
          <span class="absolute inset-x-0 bottom-0 truncate bg-night-950/85 px-1 text-[11px]">
            {{ card.name }}
          </span>
          <span
            class="absolute top-1 right-1 rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-night-950"
          >
            {{ t('cards.quantity', { count: card.tradable }) }}
          </span>
          <span
            v-if="card.inViewerWishlist"
            class="absolute top-1 left-1 rounded-full bg-sakura-600 px-1.5 text-[10px] font-bold text-white"
          >
            ♥
          </span>
        </button>
      </li>
    </ul>
    <p v-if="data && data.items.length === 0" class="text-sm text-mist-300">
      {{ t('trades.noTradable') }}
    </p>
    <PaginationBar v-model:page="page" :page-size="PAGE_SIZE" :total="data?.total ?? 0" />
  </div>
</template>
