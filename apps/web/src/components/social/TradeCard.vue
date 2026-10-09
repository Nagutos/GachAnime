<script setup lang="ts">
import type { TradeDto } from '@gachanime/shared'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useTradeActionMutation } from '@/api/social'
import { useErrorMessage } from '@/app/errors'
import { playerUi } from '@/components/ui'
import MiniCard from './MiniCard.vue'
import FeaturedCard from './FeaturedCard.vue'
import PlayerAvatar from './PlayerAvatar.vue'

const props = defineProps<{ trade: TradeDto }>()
const { t, d } = useI18n()
const action = useTradeActionMutation()
const errorMessage = useErrorMessage(action.error)

function run(kind: 'accept' | 'decline' | 'cancel'): void {
  action.mutate({ id: props.trade.id, action: kind })
}

const STATUS_CLASSES: Record<TradeDto['status'], string> = {
  pending: 'bg-gold-400/20 text-gold-400',
  accepted: 'bg-emerald-500/20 text-emerald-400',
  declined: 'bg-night-700 text-mist-300',
  cancelled: 'bg-night-700 text-mist-300',
  countered: 'bg-rarity-epic/20 text-rarity-epic',
  expired: 'bg-night-700 text-mist-300',
  failed: 'bg-rarity-mythic/20 text-rarity-mythic',
}
</script>

<template>
  <article :class="[playerUi.panel, 'flex flex-col gap-4 p-4']" :data-testid="`trade-${trade.id}`">
    <header class="flex flex-wrap items-center gap-3">
      <PlayerAvatar :name="trade.counterpart.displayName" :url="trade.counterpart.avatarUrl" />
      <FeaturedCard v-if="trade.counterpart.featured" :card="trade.counterpart.featured" />
      <p class="flex-1">
        <RouterLink
          :to="{ name: 'profile', params: { username: trade.counterpart.username } }"
          class="font-semibold hover:text-sakura-400"
        >
          {{ trade.counterpart.displayName }}
        </RouterLink>
        <span class="text-sm text-mist-300">
          · {{ trade.outgoing ? t('trades.sentOn') : t('trades.receivedOn') }}
          {{ d(new Date(trade.createdAt), 'long') }}
        </span>
      </p>
      <span
        class="rounded-full px-2 py-0.5 text-xs font-semibold"
        :class="STATUS_CLASSES[trade.status]"
      >
        {{ t(`trades.status.${trade.status}`) }}
      </span>
    </header>
    <p v-if="trade.message" class="rounded-lg bg-night-800/60 px-3 py-2 text-sm italic">
      « {{ trade.message }} »
    </p>
    <div class="grid gap-4 md:grid-cols-2">
      <section class="flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-mist-300">{{ t('trades.youGive') }}</h3>
        <MiniCard
          v-for="item in trade.give"
          :key="item.character.id"
          :character="item.character"
          :quantity="item.quantity"
          :wished="item.wishedByReceiver ? t('trades.inTheirWishlist') : null"
        />
      </section>
      <section class="flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-mist-300">{{ t('trades.youReceive') }}</h3>
        <MiniCard
          v-for="item in trade.receive"
          :key="item.character.id"
          :character="item.character"
          :quantity="item.quantity"
          :wished="item.wishedByReceiver ? t('trades.inMyWishlist') : null"
        />
      </section>
    </div>
    <p v-if="trade.expiresAt && trade.status === 'pending'" class="text-xs text-mist-300">
      {{ t('trades.expiresOn', { date: d(new Date(trade.expiresAt), 'long') }) }}
    </p>
    <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
    <footer v-if="trade.status === 'pending'" class="flex flex-wrap justify-end gap-2">
      <template v-if="!trade.outgoing">
        <button
          type="button"
          class="rounded-xl border border-night-700 px-4 py-2 hover:bg-night-800"
          :disabled="action.isPending.value"
          data-testid="decline-trade"
          @click="run('decline')"
        >
          {{ t('trades.decline') }}
        </button>
        <RouterLink
          :to="{ name: 'trade-new', query: { to: trade.counterpart.username, counter: trade.id } }"
          class="rounded-xl border border-night-700 px-4 py-2 hover:bg-night-800"
        >
          {{ t('trades.counter') }}
        </RouterLink>
        <button
          type="button"
          class="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-night-950 hover:brightness-110 disabled:opacity-50"
          :disabled="action.isPending.value"
          data-testid="accept-trade"
          @click="run('accept')"
        >
          {{ t('trades.accept') }}
        </button>
      </template>
      <button
        v-else
        type="button"
        class="rounded-xl border border-night-700 px-4 py-2 hover:bg-night-800"
        :disabled="action.isPending.value"
        data-testid="cancel-trade"
        @click="run('cancel')"
      >
        {{ t('trades.cancel') }}
      </button>
    </footer>
  </article>
</template>
