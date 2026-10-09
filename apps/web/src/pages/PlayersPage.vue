<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { usePlayersQuery } from '@/api/social'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import FeaturedCard from '@/components/social/FeaturedCard.vue'
import PlayerAvatar from '@/components/social/PlayerAvatar.vue'
import { playerUi } from '@/components/ui'

const { t, n } = useI18n()
const search = ref('')
const debounced = refDebounced(search, 300)
const page = ref(1)
watch(debounced, () => (page.value = 1))
const players = usePlayersQuery(
  computed(() => ({ page: page.value, search: debounced.value || undefined })),
)
const data = computed(() => players.data.value)
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header>
        <h1 :class="playerUi.title">{{ t('players.title') }}</h1>
        <p class="text-mist-300">{{ t('players.subtitle') }}</p>
      </header>
      <input
        v-model="search"
        type="search"
        :class="playerUi.input"
        :placeholder="t('players.search')"
        :aria-label="t('players.search')"
      />
      <ul v-if="data" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="players-list">
        <li v-for="player in data.items" :key="player.username">
          <RouterLink
            :to="{ name: 'profile', params: { username: player.username } }"
            :class="[playerUi.panel, 'flex items-center gap-3 p-3 hover:border-sakura-400/60']"
          >
            <PlayerAvatar :name="player.displayName" :url="player.avatarUrl" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ player.displayName }}</p>
              <p class="text-xs text-mist-300">@{{ player.username }}</p>
            </div>
            <span class="text-sm text-mist-300 tabular-nums">
              {{ t('players.owned', { count: n(player.owned, 'integer') }) }}
            </span>
            <FeaturedCard v-if="player.featured" :card="player.featured" />
          </RouterLink>
        </li>
      </ul>
      <PaginationBar
        v-if="data"
        :page="page"
        :page-size="data.pageSize"
        :total="data.total"
        @update:page="(value: number) => (page = value)"
      />
    </RequireSignIn>
  </main>
</template>
