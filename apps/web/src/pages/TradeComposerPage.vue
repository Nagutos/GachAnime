<script setup lang="ts">
import type { CharacterCard, PlayerCard } from '@gachanime/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerProfileQuery, useProposeTradeMutation, useTradeQuery } from '@/api/social'
import { useErrorMessage } from '@/app/errors'
import { useSession } from '@/app/session'
import BackLink from '@/components/BackLink.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import CardPicker from '@/components/social/CardPicker.vue'
import MiniCard from '@/components/social/MiniCard.vue'
import PlayerAvatar from '@/components/social/PlayerAvatar.vue'
import { playerUi } from '@/components/ui'

interface Selected {
  character: CharacterCard
  quantity: number
  /** Free copies available; null when unknown (counter offer prefill). */
  max: number | null
  /** Copies owned in total (last-copy warning on the side the player gives). */
  owned: number | null
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { me } = useSession()
const recipient = computed(() => (typeof route.query.to === 'string' ? route.query.to : ''))
const counterId = computed(() => {
  const value = Number(route.query.counter)
  return Number.isInteger(value) && value > 0 ? value : null
})

const profile = usePlayerProfileQuery(recipient)
const original = useTradeQuery(counterId)
const propose = useProposeTradeMutation()
const errorMessage = useErrorMessage(propose.error)
const offer = ref<Selected[]>([])
const request = ref<Selected[]>([])
const message = ref('')

// A counter offer starts from the received one, seen from my side.
watch(
  () => original.data.value,
  (trade) => {
    if (!trade || offer.value.length || request.value.length) return
    offer.value = trade.give.map((item) => ({
      character: item.character,
      quantity: item.quantity,
      max: null,
      owned: null,
    }))
    request.value = trade.receive.map((item) => ({
      character: item.character,
      quantity: item.quantity,
      max: null,
      owned: null,
    }))
  },
  { immediate: true },
)

const lists = { offer, request }
type Side = keyof typeof lists

function add(side: Side, card: PlayerCard): void {
  const list = lists[side]
  const existing = list.value.find((item) => item.character.id === card.id)
  if (existing) {
    existing.quantity = Math.min(existing.quantity + 1, card.tradable)
    existing.max = card.tradable
    existing.owned = card.quantity
  } else {
    list.value = [
      ...list.value,
      { character: card, quantity: 1, max: card.tradable, owned: card.quantity },
    ]
  }
}

function change(side: Side, index: number, delta: number): void {
  const list = lists[side]
  const item = list.value[index]!
  const next = item.quantity + delta
  if (next < 1) list.value = list.value.filter((_, i) => i !== index)
  else if (item.max === null || next <= item.max) item.quantity = next
}

const givesLastCopy = computed(() =>
  offer.value.filter((item) => item.owned !== null && item.quantity >= item.owned),
)
const canSubmit = computed(
  () => offer.value.length > 0 && request.value.length > 0 && !propose.isPending.value,
)

async function submit(): Promise<void> {
  const body = {
    offer: offer.value.map((item) => ({ characterId: item.character.id, quantity: item.quantity })),
    request: request.value.map((item) => ({
      characterId: item.character.id,
      quantity: item.quantity,
    })),
    message: message.value.trim() || undefined,
  }
  await propose.mutateAsync(
    counterId.value
      ? { counter: counterId.value, body }
      : { propose: { recipient: recipient.value, ...body } },
  )
  void router.push({ name: 'trades' })
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-center gap-4">
        <BackLink :to="{ name: 'trades' }" :label="t('trades.back')" />
        <h1 :class="[playerUi.title, 'flex-1']">
          {{ counterId ? t('trades.counterTitle') : t('trades.newTitle') }}
        </h1>
      </header>
      <p v-if="!recipient" :class="playerUi.panel">{{ t('trades.pickPlayer') }}</p>
      <template v-else-if="profile.data.value && me">
        <div :class="[playerUi.panel, 'flex items-center gap-3 p-3']">
          <PlayerAvatar
            :name="profile.data.value.displayName"
            :url="profile.data.value.avatarUrl"
          />
          <p>{{ t('trades.with', { name: profile.data.value.displayName }) }}</p>
        </div>
        <div class="grid gap-6 lg:grid-cols-2">
          <section :class="[playerUi.panel, 'flex flex-col gap-3']">
            <h2 class="font-display text-lg font-bold">{{ t('trades.youGive') }}</h2>
            <div class="flex flex-col gap-2" data-testid="offer-list">
              <div
                v-for="(item, index) in offer"
                :key="item.character.id"
                class="flex items-center gap-2"
              >
                <MiniCard class="flex-1" :character="item.character" :quantity="item.quantity" />
                <button
                  type="button"
                  class="px-2"
                  :aria-label="t('trades.less')"
                  @click="change('offer', index, -1)"
                >
                  −
                </button>
                <button
                  type="button"
                  class="px-2"
                  :aria-label="t('trades.more')"
                  @click="change('offer', index, 1)"
                >
                  +
                </button>
              </div>
              <p v-if="offer.length === 0" class="text-sm text-mist-300">
                {{ t('trades.pickOffer') }}
              </p>
            </div>
            <CardPicker
              :username="me.username"
              :wished-label="t('trades.inTheirWishlist')"
              test-id="my-cards"
              @pick="(card) => add('offer', card)"
            />
          </section>
          <section :class="[playerUi.panel, 'flex flex-col gap-3']">
            <h2 class="font-display text-lg font-bold">{{ t('trades.youReceive') }}</h2>
            <div class="flex flex-col gap-2" data-testid="request-list">
              <div
                v-for="(item, index) in request"
                :key="item.character.id"
                class="flex items-center gap-2"
              >
                <MiniCard class="flex-1" :character="item.character" :quantity="item.quantity" />
                <button
                  type="button"
                  class="px-2"
                  :aria-label="t('trades.less')"
                  @click="change('request', index, -1)"
                >
                  −
                </button>
                <button
                  type="button"
                  class="px-2"
                  :aria-label="t('trades.more')"
                  @click="change('request', index, 1)"
                >
                  +
                </button>
              </div>
              <p v-if="request.length === 0" class="text-sm text-mist-300">
                {{ t('trades.pickRequest') }}
              </p>
            </div>
            <CardPicker
              :username="recipient"
              :wished-label="t('trades.inMyWishlist')"
              test-id="their-cards"
              @pick="(card) => add('request', card)"
            />
          </section>
        </div>
        <label class="flex flex-col gap-1 text-sm text-mist-300">
          {{ t('trades.message') }}
          <input v-model="message" maxlength="300" :class="playerUi.input" />
        </label>
        <p
          v-if="givesLastCopy.length"
          class="rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-sm text-gold-400"
          role="alert"
          data-testid="last-copy-warning"
        >
          {{
            t('trades.lastCopyWarning', {
              names: givesLastCopy.map((item) => item.character.name).join(', '),
            })
          }}
        </p>
        <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
        <div class="flex justify-end">
          <button
            type="button"
            class="rounded-xl bg-sakura-600 px-5 py-3 font-semibold text-white hover:bg-sakura-700 disabled:opacity-50"
            :disabled="!canSubmit"
            data-testid="send-trade"
            @click="submit"
          >
            {{ counterId ? t('trades.sendCounter') : t('trades.send') }}
          </button>
        </div>
      </template>
      <p v-else class="text-mist-300">{{ t('common.loading') }}</p>
    </RequireSignIn>
  </main>
</template>
