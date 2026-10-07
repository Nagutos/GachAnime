<script setup lang="ts">
import { resolveLocalizedText } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { usePlayerCardsQuery, usePlayerProfileQuery } from '@/api/social'
import { useErrorMessage } from '@/app/errors'
import { usePlayerRarities } from '@/app/rarities'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import PlayerAvatar from '@/components/social/PlayerAvatar.vue'
import { playerUi } from '@/components/ui'

const PAGE_SIZE = 30
const props = defineProps<{ username: string }>()
const { t, n, d, locale } = useI18n()
const { rarities, nameOf } = usePlayerRarities()
const tab = ref<'cards' | 'achievements'>('cards')
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
const stats = computed(() =>
  data.value
    ? ([
        [
          'owned',
          t('profile.stats.owned', {
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
            class="rounded-xl bg-sakura-500 px-4 py-2 font-semibold text-white hover:bg-sakura-600"
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

        <div class="flex gap-1 border-b border-night-700" role="tablist">
          <button
            v-for="value in ['cards', 'achievements'] as const"
            :key="value"
            type="button"
            role="tab"
            :aria-selected="tab === value"
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
            <select v-model="rarity" :class="playerUi.select" :aria-label="t('collection.rarity')">
              <option value="">{{ t('collection.allRarities') }}</option>
              <option v-for="item in [...rarities].reverse()" :key="item.key" :value="item.key">
                {{ nameOf(item.key) }}
              </option>
            </select>
          </div>
          <ul v-if="cards.data.value" :class="playerUi.cardGrid" data-testid="profile-cards">
            <li v-for="card in cards.data.value.items" :key="card.id" class="relative">
              <RouterLink :to="{ name: 'wiki-character', params: { id: card.id } }">
                <CharacterCard
                  :name="card.name"
                  :image-url="card.imageUrl"
                  :rarity-key="card.rarityKey"
                  :series-title="card.series?.title"
                  :quantity="card.quantity"
                />
              </RouterLink>
              <span
                v-if="card.inViewerWishlist && !data.isMe"
                class="absolute right-1.5 bottom-12 rounded-full bg-sakura-500 px-2 py-0.5 text-[10px] font-bold text-white"
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
