<script setup lang="ts">
import {
  resolveLocalizedText,
  type BoosterQuantity,
  type BoosterTierDto,
  type OpenBoostersResponse,
} from '@gachanime/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBoostersQuery, useOpenBoostersMutation } from '@/api/player'
import { useErrorMessage } from '@/app/errors'
import { formatCountdown, useServerNow } from '@/app/now'
import { usePlayerRarities } from '@/app/rarities'
import BoosterOpening from '@/components/booster/BoosterOpening.vue'
import BoosterPack from '@/components/booster/BoosterPack.vue'
import { rarityStyle } from '@/components/cards/rarity-styles'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const { t, n, locale } = useI18n()
const { rarities, nameOf } = usePlayerRarities()
const boosters = useBoostersQuery()
const open = useOpenBoostersMutation()
const errorMessage = useErrorMessage(open.error)

const QUANTITIES: BoosterQuantity[] = [1, 5, 10]
const RATE_TOTAL = 1_000_000

const free = computed(() => boosters.data.value?.free)
const freeTiers = computed(() =>
  (boosters.data.value?.tiers ?? []).filter((tier) => tier.priceGems === null),
)

/** Server clock offset, so the countdown matches the server's charges. */
const offset = ref(0)
watch(free, (status) => {
  if (status) offset.value = Date.parse(status.serverTime) - Date.now()
})
const now = useServerNow(offset)
const nextChargeMs = computed(() =>
  free.value?.nextChargeAt ? Date.parse(free.value.nextChargeAt) : null,
)
const countdown = computed(() =>
  nextChargeMs.value === null ? null : formatCountdown(nextChargeMs.value, now.value),
)
// A charge arrived: ask the server for the new state.
watch(now, (value) => {
  if (nextChargeMs.value !== null && value >= nextChargeMs.value && !boosters.isFetching.value) {
    void boosters.refetch()
  }
})

const opening = ref<{ result: OpenBoostersResponse; label: string } | null>(null)

function tierName(tier: BoosterTierDto): string {
  return resolveLocalizedText(tier.name, locale.value)
}

async function openBoosters(tier: BoosterTierDto, quantity: BoosterQuantity): Promise<void> {
  const result = await open.mutateAsync({ tier: tier.key, quantity }).catch(() => null)
  if (result) opening.value = { result, label: tierName(tier) }
}

function rateOf(tier: BoosterTierDto, key: string): number {
  return (tier.weights[key] ?? 0) / RATE_TOTAL
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header>
        <h1 :class="playerUi.title">{{ t('boosters.title') }}</h1>
        <p class="text-mist-300">{{ t('boosters.subtitle') }}</p>
      </header>

      <p v-if="boosters.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="freeTiers.length === 0" :class="playerUi.panel">{{ t('boosters.noTier') }}</p>

      <section
        v-for="tier in freeTiers"
        :key="tier.key"
        :class="[playerUi.panel, 'flex flex-col gap-6 md:flex-row md:items-center']"
        :data-testid="`tier-${tier.key}`"
      >
        <div class="mx-auto w-40 shrink-0 md:mx-0 md:w-48">
          <BoosterPack :label="tierName(tier)" :cards="boosters.data.value!.cardsPerBooster" idle />
        </div>

        <div class="flex flex-1 flex-col gap-4">
          <div>
            <h2 class="font-display text-2xl font-bold">{{ tierName(tier) }}</h2>
            <p v-if="tier.description" class="text-mist-300">
              {{ resolveLocalizedText(tier.description, locale) }}
            </p>
          </div>

          <div v-if="free" class="flex flex-col gap-2">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="text-sm text-mist-300">{{ t('boosters.chargesLabel') }}</span>
              <span class="font-display text-2xl font-bold tabular-nums" data-testid="charges">
                {{ t('boosters.charges', { available: free.available, max: free.max }) }}
              </span>
            </div>
            <div class="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              <span
                v-for="index in free.max"
                :key="index"
                class="flex-1"
                :class="index <= free.available ? 'bg-sakura-400' : 'bg-night-700'"
              />
            </div>
            <p class="text-sm text-mist-300" aria-live="polite">
              <template v-if="countdown">{{ t('boosters.nextIn', { time: countdown }) }}</template>
              <template v-else>{{ t('boosters.full') }}</template>
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              v-for="quantity in QUANTITIES"
              :key="quantity"
              type="button"
              class="min-w-28 rounded-xl bg-sakura-500 px-5 py-3 font-semibold text-white shadow-lg shadow-sakura-500/20 transition hover:bg-sakura-600 disabled:cursor-not-allowed disabled:bg-night-700 disabled:text-mist-300 disabled:shadow-none"
              :disabled="open.isPending.value || !free || free.available < quantity"
              :data-testid="`open-${quantity}`"
              @click="openBoosters(tier, quantity)"
            >
              {{
                open.isPending.value
                  ? t('boosters.opening')
                  : t('boosters.open', { count: quantity })
              }}
            </button>
          </div>
          <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>

          <details class="text-sm">
            <summary class="cursor-pointer text-mist-300 hover:text-mist-100">
              {{ t('boosters.rates') }}
            </summary>
            <ul class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              <li
                v-for="rarity in [...rarities].reverse()"
                :key="rarity.key"
                class="flex justify-between gap-2"
              >
                <span :class="rarityStyle(rarity.key).text">{{ nameOf(rarity.key) }}</span>
                <span class="tabular-nums">{{ n(rateOf(tier, rarity.key), 'rate') }}</span>
              </li>
            </ul>
          </details>
        </div>
      </section>

      <BoosterOpening
        v-if="opening"
        :result="opening.result"
        :pack-label="opening.label"
        @close="opening = null"
      />
    </RequireSignIn>
  </main>
</template>
