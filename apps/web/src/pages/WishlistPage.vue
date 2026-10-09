<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useWishlistQuery } from '@/api/player'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import LockedCard from '@/components/cards/LockedCard.vue'
import CollectionTabs from '@/components/collection/CollectionTabs.vue'
import WishlistButton from '@/components/collection/WishlistButton.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const { t, n } = useI18n()
const wishlist = useWishlistQuery()
const data = computed(() => wishlist.data.value)
const isFull = computed(() => !!data.value && data.value.items.length >= data.value.maxItems)

/** The boost only applies to wished characters the player does not own now. */
function isBoosted(item: { locked: boolean; quantity?: number }): boolean {
  return item.locked || item.quantity === 0
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-col gap-1">
        <h1 :class="playerUi.title">{{ t('wishlist.title') }}</h1>
        <p v-if="data" class="text-mist-300" data-testid="wishlist-count">
          {{
            t('wishlist.count', {
              count: n(data.items.length, 'integer'),
              max: n(data.maxItems, 'integer'),
            })
          }}
        </p>
      </header>

      <CollectionTabs />

      <p v-if="wishlist.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <template v-else-if="data">
        <p class="text-sm text-mist-300" data-testid="wishlist-boost">
          {{ t('wishlist.boostHelp', { percent: n(data.boostPercent / 100, 'percent') }) }}
        </p>
        <p
          v-if="isFull"
          class="rounded-xl border border-sakura-500/40 bg-sakura-500/10 px-4 py-2 text-sm"
          data-testid="wishlist-full"
        >
          {{ t('wishlist.full') }}
        </p>

        <div
          v-if="data.items.length === 0"
          :class="[playerUi.panel, 'flex flex-col items-center gap-3 text-center']"
        >
          <p>{{ t('wishlist.empty') }}</p>
          <RouterLink
            :to="{ name: 'wiki' }"
            class="rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700"
          >
            {{ t('wishlist.browseWiki') }}
          </RouterLink>
        </div>
        <ul v-else :class="playerUi.cardGrid" data-testid="wishlist-grid">
          <li v-for="item in data.items" :key="item.id" class="relative">
            <LockedCard
              v-if="item.locked"
              :to="{ name: 'wiki-character', params: { id: item.id } }"
              :name="item.name"
              :image-url="item.imageUrl"
              :rarity-key="item.rarityKey"
              :series="item.series"
              class="transition hover:-translate-y-1"
            />
            <CharacterCard
              v-else
              :to="{ name: 'wiki-character', params: { id: item.id } }"
              :name="item.name"
              :image-url="item.imageUrl"
              :rarity-key="item.rarityKey"
              :series="item.series"
              :quantity="item.quantity"
              class="transition hover:-translate-y-1"
              :class="{ 'opacity-60 grayscale': item.quantity === 0 }"
            />
            <span
              class="pointer-events-none absolute bottom-13 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shadow"
              :class="
                isBoosted(item)
                  ? 'bg-sakura-600 text-white'
                  : 'border border-night-500 bg-night-950/80 text-mist-300'
              "
              :data-testid="isBoosted(item) ? 'wishlist-boosted' : 'wishlist-owned'"
            >
              {{ isBoosted(item) ? t('wishlist.boosted') : t('wishlist.owned') }}
            </span>
            <WishlistButton
              class="absolute right-1.5 bottom-12"
              :character-id="item.id"
              :wishlisted="item.wishlisted"
            />
          </li>
        </ul>
      </template>
    </RequireSignIn>
  </main>
</template>
