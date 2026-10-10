<script setup lang="ts">
import type { PublicTradeDto } from '@gachanime/shared'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { playerUi } from '@/components/ui'
import FeaturedCard from './FeaturedCard.vue'
import MiniCard from './MiniCard.vue'
import PlayerAvatar from './PlayerAvatar.vue'

/** A pending trade between two other players: watched, never acted on. */
defineProps<{ trade: PublicTradeDto }>()
const { t, d } = useI18n()
</script>

<template>
  <article
    :class="[playerUi.panel, 'flex flex-col gap-4 p-4']"
    :data-testid="`public-trade-${trade.id}`"
  >
    <header class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-mist-300">
        {{ t('trades.public.since', { date: d(new Date(trade.createdAt), 'long') }) }}
        <template v-if="trade.parentTradeId">· {{ t('trades.public.counter') }}</template>
      </p>
      <span class="rounded-full bg-gold-400/20 px-2 py-0.5 text-xs font-semibold text-gold-400">
        {{ t('trades.status.pending') }}
      </span>
    </header>
    <div class="grid gap-4 md:grid-cols-2">
      <section
        v-for="side in [
          { player: trade.proposer, items: trade.proposerGives },
          { player: trade.recipient, items: trade.recipientGives },
        ]"
        :key="side.player.username"
        class="flex flex-col gap-2"
      >
        <h3 class="flex items-center gap-2 text-sm font-semibold text-mist-300">
          <PlayerAvatar :name="side.player.displayName" :url="side.player.avatarUrl" size="sm" />
          <FeaturedCard v-if="side.player.featured" :card="side.player.featured" />
          <RouterLink
            :to="{ name: 'profile', params: { username: side.player.username } }"
            class="text-mist-100 hover:text-sakura-400"
          >
            {{ side.player.displayName }}
          </RouterLink>
          {{ t('trades.public.gives') }}
        </h3>
        <MiniCard
          v-for="item in side.items"
          :key="item.character.id"
          :character="item.character"
          :quantity="item.quantity"
          :wished="item.wishedByReceiver ? t('trades.public.wished') : null"
        />
      </section>
    </div>
    <p v-if="trade.expiresAt" class="text-xs text-mist-300">
      {{ t('trades.expiresOn', { date: d(new Date(trade.expiresAt), 'long') }) }}
    </p>
  </article>
</template>
