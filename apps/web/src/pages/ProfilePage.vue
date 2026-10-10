<script setup lang="ts">
import { resolveLocalizedText } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { usePlayerCardsQuery, usePlayerProfileQuery, usePlayerWishlistQuery } from '@/api/social'
import { useErrorMessage } from '@/app/errors'
import { usePlayerRarities } from '@/app/rarities'
import AppSelect from '@/components/AppSelect.vue'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import FeaturedCard from '@/components/social/FeaturedCard.vue'
import PlayerAvatar from '@/components/social/PlayerAvatar.vue'
import { playerUi } from '@/components/ui'

const PAGE_SIZE = 30
const props = defineProps<{ username: string }>()
const { t, n, d, locale } = useI18n()
const { filterOptions: rarityOptions } = usePlayerRarities()
const TABS = ['cards', 'wishlist', 'achievements'] as const
const tab = ref<(typeof TABS)[number]>('cards')
const search = ref('')
const debounced = refDebounced(search, 300)
const rarity = ref('')
const page = ref(1)
watch([debounced, rarity, () => props.username], () => (page.value = 1))

const profile = usePlayerProfileQuery(() => props.username)
const errorMessage = useErrorMessage(profile.error)
const cards = usePlayerCardsQuery(
  () => props.username,
  computed(() => ({
    page: page.value,
    pageSize: PAGE_SIZE,
    search: debounced.value || undefined,
    rarity: rarity.value || undefined,
  })),
)
const data = computed(() => profile.data.value)
const wishlist = usePlayerWishlistQuery(() => props.username)
const stats = computed(() =>
  data.value
    ? ([
        [
          'owned',
          t('profile.stats.ownedValue', {
            owned: n(data.value.stats.owned, 'integer'),
            catalog: n(data.value.stats.catalog, 'integer'),
          }),
        ],
        ['cards', n(data.value.stats.cards, 'integer')],
        ['series', n(data.value.stats.seriesCompleted, 'integer')],
        [
          'achievements',
          t('profile.stats.achievementsValue', {
            done: data.value.stats.achievementsCompleted,
            total: data.value.stats.achievementsTotal,
          }),
        ],
      ] as const)
    : [],
)
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <p v-if="profile.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
      <template v-else-if="data">
        <header :class="[playerUi.panel, 'flex flex-wrap items-center gap-5']">
          <PlayerAvatar :name="data.displayName" :url="data.avatarUrl" size="lg" />
          <FeaturedCard v-if="data.showcase[0]" :card="data.showcase[0]" size="lg" />
          <div class="min-w-0 flex-1">
            <h1 :class="playerUi.title" data-testid="profile-name">{{ data.displayName }}</h1>
            <p class="text-mist-300">
              @{{ data.username }} ·
              {{ t('profile.memberSince', { date: d(new Date(data.memberSince), 'short') }) }}
            </p>
          </div>
          <RouterLink
            v-if="!data.isMe"
            :to="{ name: 'trade-new', query: { to: data.username } }"
            class="rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700"
            data-testid="propose-trade"
          >
            {{ t('profile.proposeTrade') }}
          </RouterLink>
        </header>
        <dl class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div v-for="[key, value] in stats" :key="key" :class="[playerUi.panel, 'p-4']">
            <dt class="text-sm text-mist-300">{{ t(`profile.stats.${key}`) }}</dt>
            <dd class="font-display text-2xl font-bold tabular-nums">{{ value }}</dd>
          </div>
        </dl>

        <section
          v-if="data.showcase.length || data.isMe"
          class="flex flex-col gap-3"
          data-testid="profile-showcase"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="font-display text-xl font-bold">{{ t('profile.showcase') }}</h2>
            <RouterLink
              v-if="data.isMe"
              :to="{ name: 'collection-favorites' }"
              class="text-sm text-mist-300 underline hover:text-sakura-400"
            >
              {{ data.showcase.length ? t('profile.arrangeShowcase') : t('profile.fillShowcase') }}
            </RouterLink>
          </div>
          <ol
            v-if="data.showcase.length"
            class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"
          >
            <li v-for="card in data.showcase" :key="card.id">
              <CharacterCard
                :to="{ name: 'wiki-character', params: { id: card.id } }"
                :name="card.name"
                :image-url="card.imageUrl"
                :rarity-key="card.rarityKey"
                :series="card.series"
                class="transition hover:-translate-y-1"
              />
            </li>
          </ol>
          <p v-else class="text-sm text-mist-300">{{ t('profile.emptyShowcase') }}</p>
        </section>

        <div class="flex gap-1 border-b border-night-700" role="tablist">
          <button
            v-for="value in TABS"
            :key="value"
            type="button"
            role="tab"
            :aria-selected="tab === value"
            :data-testid="`profile-tab-${value}`"
            class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
            :class="
              tab === value
                ? 'border-sakura-400 text-mist-100'
                : 'border-transparent text-mist-300 hover:text-mist-100'
            "
            @click="tab = value"
          >
            {{ t(`profile.tabs.${value}`) }}
          </button>
        </div>

        <template v-if="tab === 'cards'">
          <div class="flex flex-wrap gap-3">
            <input
              v-model="search"
              type="search"
              :class="[playerUi.input, 'min-w-48 flex-1']"
              :placeholder="t('collection.searchPlaceholder')"
              :aria-label="t('collection.searchPlaceholder')"
            />
            <AppSelect
              v-model="rarity"
              :options="rarityOptions"
              :aria-label="t('collection.rarity')"
            />
          </div>
          <ul v-if="cards.data.value" :class="playerUi.cardGrid" data-testid="profile-cards">
            <li v-for="card in cards.data.value.items" :key="card.id" class="relative">
              <CharacterCard
                :to="{ name: 'wiki-character', params: { id: card.id } }"
                :name="card.name"
                :image-url="card.imageUrl"
                :rarity-key="card.rarityKey"
                :series="card.series"
                :quantity="card.quantity"
                class="transition hover:-translate-y-1"
              />
              <span
                v-if="card.inViewerWishlist && !data.isMe"
                class="absolute right-1.5 bottom-12 rounded-full bg-sakura-600 px-2 py-0.5 text-[10px] font-bold text-white"
              >
                {{ t('trades.inMyWishlist') }}
              </span>
            </li>
          </ul>
          <PaginationBar
            v-if="cards.data.value"
            :page="page"
            :page-size="PAGE_SIZE"
            :total="cards.data.value.total"
            @update:page="(value: number) => (page = value)"
          />
        </template>
        <template v-else-if="tab === 'wishlist'">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p
              v-if="wishlist.data.value"
              class="text-mist-300"
              data-testid="profile-wishlist-count"
            >
              {{
                t('wishlist.count', {
                  count: n(wishlist.data.value.items.length, 'integer'),
                  max: n(wishlist.data.value.maxItems, 'integer'),
                })
              }}
            </p>
            <RouterLink
              v-if="data.isMe"
              :to="{ name: 'collection-wishlist' }"
              class="rounded-xl border border-night-700 bg-night-800 px-4 py-2 text-sm font-semibold hover:bg-night-700"
            >
              {{ t('wishlist.manage') }}
            </RouterLink>
            <p v-else class="text-sm text-mist-300">{{ t('profile.wishlistHelp') }}</p>
          </div>
          <p v-if="wishlist.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
          <p v-else-if="wishlist.data.value?.items.length === 0" class="text-mist-300">
            {{ t('profile.noWishlist') }}
          </p>
          <ul
            v-else-if="wishlist.data.value"
            :class="playerUi.cardGrid"
            data-testid="profile-wishlist"
          >
            <li v-for="item in wishlist.data.value.items" :key="item.id" class="relative">
              <CharacterCard
                :to="{ name: 'wiki-character', params: { id: item.id } }"
                :name="item.name"
                :image-url="item.imageUrl"
                :rarity-key="item.rarityKey"
                :series="item.series"
                class="transition hover:-translate-y-1"
              />
              <div
                class="pointer-events-none absolute bottom-12 left-1.5 flex flex-col items-start gap-1"
              >
                <span
                  v-if="item.ownerOwns"
                  class="rounded-full border border-night-500 bg-night-950/85 px-2 py-0.5 text-[10px] font-bold text-mist-300 uppercase"
                >
                  {{ t('wishlist.owned') }}
                </span>
                <span
                  v-if="!data.isMe && item.viewerTradable > 0"
                  class="rounded-full bg-sakura-600 px-2 py-0.5 text-[10px] font-bold text-white"
                  data-testid="viewer-has-it"
                >
                  {{ t('profile.youHaveIt', { count: item.viewerTradable }) }}
                </span>
              </div>
            </li>
          </ul>
        </template>
        <ul v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="achievement in data.achievements"
            :key="achievement.key"
            :class="[playerUi.panel, 'flex items-center gap-3 p-3']"
          >
            <span class="text-gold-400" aria-hidden="true">★</span>
            <div>
              <p class="font-semibold">{{ resolveLocalizedText(achievement.name, locale) }}</p>
              <p class="text-xs text-mist-300">
                {{
                  t('achievements.completedOn', {
                    date: d(new Date(achievement.completedAt), 'short'),
                  })
                }}
              </p>
            </div>
          </li>
          <li v-if="data.achievements.length === 0" class="text-mist-300">
            {{ t('profile.noAchievements') }}
          </li>
        </ul>
      </template>
    </RequireSignIn>
  </main>
</template>
