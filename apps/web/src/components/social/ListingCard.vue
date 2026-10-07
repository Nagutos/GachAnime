<script setup lang="ts">
import type { ListingDto } from '@gachanime/shared'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import CharacterCard from '@/components/cards/CharacterCard.vue'

defineProps<{ listing: ListingDto; busy?: boolean }>()
const emit = defineEmits<{ buy: []; withdraw: [] }>()
const { t, n } = useI18n()
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-xl p-1.5"
    :class="listing.inMyWishlist ? 'bg-sakura-500/15 ring-2 ring-sakura-400/60' : ''"
    :data-testid="`listing-${listing.id}`"
  >
    <RouterLink
      :to="{ name: 'wiki-character', params: { id: listing.character.id } }"
      class="relative"
    >
      <CharacterCard
        :name="listing.character.name"
        :image-url="listing.character.imageUrl"
        :rarity-key="listing.character.rarityKey"
        :series-title="listing.character.series?.title"
        :effects="false"
      />
      <span
        v-if="listing.inMyWishlist"
        class="absolute right-1.5 bottom-12 rounded-full bg-sakura-500 px-2 py-0.5 text-[10px] font-bold text-white"
      >
        {{ t('market.inWishlist') }}
      </span>
    </RouterLink>
    <div class="flex items-center justify-between gap-1 px-1 text-sm">
      <span class="font-display font-bold text-gold-400 tabular-nums">
        {{ t('nav.gems', { count: n(listing.price, 'integer') }) }}
      </span>
      <RouterLink
        :to="{ name: 'profile', params: { username: listing.seller.username } }"
        class="truncate text-xs text-mist-300 hover:text-sakura-400"
      >
        @{{ listing.seller.username }}
      </RouterLink>
    </div>
    <p v-if="!listing.isMine" class="px-1 text-xs text-mist-300">
      {{
        listing.myQuantity > 0
          ? t('market.youOwn', { count: listing.myQuantity })
          : t('market.youMiss')
      }}
    </p>
    <button
      v-if="listing.status === 'active' && !listing.isMine"
      type="button"
      class="rounded-lg bg-sakura-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sakura-600 disabled:opacity-50"
      :disabled="busy"
      data-testid="buy-listing"
      @click="emit('buy')"
    >
      {{ t('market.buy') }}
    </button>
    <button
      v-else-if="listing.status === 'active'"
      type="button"
      class="rounded-lg border border-night-700 px-3 py-1.5 text-sm hover:bg-night-800 disabled:opacity-50"
      :disabled="busy"
      data-testid="withdraw-listing"
      @click="emit('withdraw')"
    >
      {{ t('market.withdraw') }}
    </button>
    <p v-else class="px-1 text-xs text-mist-300">
      {{ t(`market.status.${listing.status}`) }}
      <template v-if="listing.buyer && listing.isMine">
        · {{ t('market.boughtBy', { name: listing.buyer.displayName }) }}
      </template>
      <template v-else-if="!listing.isMine">· {{ t('market.boughtByMe') }}</template>
    </p>
  </div>
</template>
