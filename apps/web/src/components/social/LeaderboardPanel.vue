<script setup lang="ts">
import type { LeaderboardEntry } from '@gachanime/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useLeaderboardQuery } from '@/api/social'
import FeaturedCard from './FeaturedCard.vue'
import PlayerAvatar from './PlayerAvatar.vue'

/** Players with the most characters, the viewer's own line below when outside the top. */
const { t, n } = useI18n()
const leaderboard = useLeaderboardQuery()
const data = computed(() => leaderboard.data.value)

/** Gold, silver and bronze for the podium. */
const PODIUM = [
  'bg-gold-400 text-night-950',
  'bg-mist-300 text-night-950',
  'bg-amber-700 text-white',
]

function percent(entry: LeaderboardEntry): string {
  const catalog = data.value?.catalog ?? 0
  return n(catalog ? entry.owned / catalog : 0, 'percent')
}
</script>

<template>
  <section
    class="flex w-full flex-col gap-4 rounded-2xl border border-night-700 bg-night-900/70 p-5 text-left"
    data-testid="leaderboard"
  >
    <div>
      <h2 class="font-display text-2xl font-bold">{{ t('home.leaderboard.title') }}</h2>
      <p class="text-mist-300">{{ t('home.leaderboard.subtitle') }}</p>
    </div>
    <p v-if="leaderboard.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <p v-else-if="data && data.entries.length === 0" class="text-mist-300">
      {{ t('home.leaderboard.empty') }}
    </p>
    <ol v-else-if="data" class="flex flex-col gap-2">
      <template
        v-for="entry in [...data.entries, ...(data.me ? [data.me] : [])]"
        :key="entry.username"
      >
        <li
          v-if="entry === data.me"
          class="mx-auto my-1 h-px w-1/3 border-t border-dashed border-night-500"
          aria-hidden="true"
        />
        <li>
          <RouterLink
            :to="{ name: 'profile', params: { username: entry.username } }"
            class="flex items-center gap-3 rounded-xl border px-3 py-2 transition hover:border-sakura-400/60"
            :class="
              entry.isMe
                ? 'border-sakura-400/50 bg-sakura-500/10'
                : 'border-night-700 bg-night-800/40'
            "
            :data-testid="`leaderboard-${entry.username}`"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums"
              :class="PODIUM[entry.rank - 1] ?? 'bg-night-700 text-mist-100'"
              :aria-label="t('home.leaderboard.rank', { rank: entry.rank })"
            >
              {{ entry.rank }}
            </span>
            <PlayerAvatar :name="entry.displayName" :url="entry.avatarUrl" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">
                {{ entry.displayName }}
                <span v-if="entry.isMe" class="text-xs font-normal text-sakura-400">
                  {{ t('home.leaderboard.you') }}
                </span>
              </p>
              <p class="truncate text-xs text-mist-300">@{{ entry.username }}</p>
            </div>
            <div class="text-right tabular-nums">
              <p class="font-display font-bold" data-testid="leaderboard-owned">
                {{ t('home.leaderboard.owned', { count: n(entry.owned, 'integer') }) }}
              </p>
              <p class="text-xs text-mist-300">
                {{
                  t('home.leaderboard.details', {
                    percent: percent(entry),
                    cards: n(entry.cards, 'integer'),
                  })
                }}
              </p>
            </div>
            <FeaturedCard v-if="entry.featured" :card="entry.featured" class="hidden sm:block" />
          </RouterLink>
        </li>
      </template>
    </ol>
  </section>
</template>
