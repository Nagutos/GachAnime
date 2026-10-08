<script setup lang="ts">
import {
  resolveLocalizedText,
  type BoosterQuantity,
  type BoosterTierDto,
  type OpenBoostersResponse,
  type ThemeDto,
} from '@gachanime/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useBoostersQuery, useOpenBoostersMutation } from '@/api/player'
import { useErrorMessage } from '@/app/errors'
import { formatCountdown, useServerNow } from '@/app/now'
import BoosterOpening from '@/components/booster/BoosterOpening.vue'
import BoosterPack from '@/components/booster/BoosterPack.vue'
import TierRates from '@/components/booster/TierRates.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const { t, n, locale } = useI18n()
const boosters = useBoostersQuery()
const open = useOpenBoostersMutation()
const errorMessage = useErrorMessage(open.error)
/** Tier of the last opening attempt, to show its error next to it. */
const lastTier = ref<string | null>(null)

const QUANTITIES: BoosterQuantity[] = [1, 5, 10]

const data = computed(() => boosters.data.value)
const free = computed(() => data.value?.free)
const freeTiers = computed(() =>
  (data.value?.tiers ?? []).filter((tier) => tier.priceGems === null),
)
const paidTiers = computed(() =>
  (data.value?.tiers ?? []).filter((tier) => tier.priceGems !== null),
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

const opening = ref<{
  result: OpenBoostersResponse
  label: string
  art: string
  color: string | null
  seal: string
} | null>(null)

/**
 * Free boosters: the whole catalog, or one of the packs (categories, character types), each a
 * booster of its own. Premium tiers always draw from the whole catalog.
 */
const themeKey = ref<string | null>(null)
const selectedTheme = computed<ThemeDto | null>(
  () => data.value?.themes.find((theme) => theme.key === themeKey.value) ?? null,
)
/** Packs in the order set by the admin (Admin → Packs → Reorder). */
const themes = computed(() => data.value?.themes ?? [])

function tierName(tier: BoosterTierDto): string {
  return resolveLocalizedText(tier.name, locale.value)
}

function themeName(theme: ThemeDto): string {
  return resolveLocalizedText(theme.name, locale.value)
}

/** Display only: the server checks charges and gems again. */
function canOpen(tier: BoosterTierDto, quantity: BoosterQuantity): boolean {
  if (open.isPending.value || !data.value) return false
  if (tier.priceGems === null) return (free.value?.available ?? 0) >= quantity
  return data.value.gemBalance >= tier.priceGems * quantity
}

async function openBoosters(tier: BoosterTierDto, quantity: BoosterQuantity): Promise<void> {
  lastTier.value = tier.key
  const theme = tier.priceGems === null ? selectedTheme.value : null
  const result = await open
    .mutateAsync({ tier: tier.key, quantity, theme: theme?.key })
    .catch(() => null)
  if (result) {
    opening.value = theme
      ? { result, label: themeName(theme), art: 'free', color: theme.color, seal: theme.seal }
      : { result, label: tierName(tier), art: tier.artToken, color: null, seal: '招' }
  }
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('boosters.title') }}</h1>
          <p class="text-mist-300">{{ t('boosters.subtitle') }}</p>
        </div>
        <RouterLink
          v-if="data"
          :to="{ name: 'gems' }"
          class="rounded-full bg-night-800 px-4 py-2 font-semibold text-gold-400 tabular-nums hover:bg-night-700"
          data-testid="boosters-gems"
        >
          {{ t('nav.gems', { count: n(data.gemBalance, 'integer') }) }}
        </RouterLink>
      </header>

      <p v-if="boosters.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="data && data.tiers.length === 0" :class="playerUi.panel">
        {{ t('boosters.noTier') }}
      </p>

      <section
        v-for="tier in freeTiers"
        :key="tier.key"
        :class="[playerUi.panel, 'flex flex-col gap-6']"
        :data-testid="`tier-${tier.key}`"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="font-display text-2xl font-bold">{{ tierName(tier) }}</h2>
            <p class="text-mist-300">{{ t('boosters.packs.help') }}</p>
          </div>
          <div v-if="free" class="flex w-full max-w-xs flex-col gap-2">
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
        </div>

        <!-- Each pack is a free booster of its own: pick one, then open it -->
        <div
          class="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-8"
          role="radiogroup"
          :aria-label="t('boosters.packs.title')"
          data-testid="pack-selector"
        >
          <button
            type="button"
            role="radio"
            :aria-checked="themeKey === null"
            class="flex flex-col items-center gap-2 rounded-xl p-1 text-center"
            data-testid="pack-all"
            @click="themeKey = null"
          >
            <BoosterPack
              :label="tierName(tier)"
              :cards="data!.cardsPerBooster"
              :art="tier.artToken"
              :front="themeKey === null"
              :idle="themeKey === null"
            />
            <span
              class="text-sm font-semibold"
              :class="themeKey === null ? 'text-mist-100' : 'text-mist-300'"
            >
              {{ t('boosters.packs.all') }}
            </span>
          </button>
          <button
            v-for="theme in themes"
            :key="theme.key"
            type="button"
            role="radio"
            :aria-checked="themeKey === theme.key"
            class="flex flex-col items-center gap-2 rounded-xl p-1 text-center"
            :data-testid="`pack-${theme.key}`"
            @click="themeKey = theme.key"
          >
            <BoosterPack
              :label="themeName(theme)"
              :cards="data!.cardsPerBooster"
              :color="theme.color"
              :seal="theme.seal"
              :front="themeKey === theme.key"
              :idle="themeKey === theme.key"
            />
            <span
              class="text-sm font-semibold"
              :class="themeKey === theme.key ? 'text-mist-100' : 'text-mist-300'"
            >
              {{ themeName(theme) }}
            </span>
            <span class="-mt-2 text-xs text-mist-300 tabular-nums">
              {{ t('boosters.packs.characters', { count: n(theme.characterCount, 'integer') }) }}
            </span>
          </button>
        </div>

        <div class="flex flex-col gap-4 border-t border-night-700 pt-5">
          <div>
            <h3 class="font-display text-xl font-bold" data-testid="pack-summary">
              {{ selectedTheme ? themeName(selectedTheme) : t('boosters.packs.all') }}
            </h3>
            <p v-if="selectedTheme?.description" class="text-mist-300">
              {{ resolveLocalizedText(selectedTheme.description, locale) }}
            </p>
            <p v-else-if="!selectedTheme && tier.description" class="text-mist-300">
              {{ resolveLocalizedText(tier.description, locale) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              v-for="quantity in QUANTITIES"
              :key="quantity"
              type="button"
              class="min-w-28 rounded-xl bg-sakura-600 px-5 py-3 font-semibold text-white shadow-lg shadow-sakura-500/20 transition hover:bg-sakura-700 disabled:cursor-not-allowed disabled:bg-night-700 disabled:text-mist-300 disabled:shadow-none"
              :disabled="!canOpen(tier, quantity)"
              :data-testid="`open-${quantity}`"
              @click="openBoosters(tier, quantity)"
            >
              {{ t('boosters.open', { count: quantity }) }}
            </button>
          </div>
          <p v-if="errorMessage && lastTier === tier.key" :class="playerUi.error" role="alert">
            {{ errorMessage }}
          </p>
          <TierRates :tier="tier" />
        </div>
      </section>

      <section v-if="paidTiers.length" class="flex flex-col gap-4">
        <div>
          <h2 class="font-display text-2xl font-bold">{{ t('boosters.paidTitle') }}</h2>
          <p class="text-mist-300">{{ t('boosters.paidSubtitle') }}</p>
        </div>
        <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <li
            v-for="tier in paidTiers"
            :key="tier.key"
            :class="[playerUi.panel, 'flex flex-col gap-4']"
            :data-testid="`tier-${tier.key}`"
          >
            <div class="mx-auto w-32">
              <BoosterPack
                :label="tierName(tier)"
                :cards="data!.cardsPerBooster"
                :art="tier.artToken"
              />
            </div>
            <div class="text-center">
              <h3 class="font-display text-xl font-bold">{{ tierName(tier) }}</h3>
              <p v-if="tier.description" class="text-sm text-mist-300">
                {{ resolveLocalizedText(tier.description, locale) }}
              </p>
              <p class="mt-2 font-semibold text-gold-400 tabular-nums">
                {{ t('boosters.pricePerPack', { price: n(tier.priceGems ?? 0, 'integer') }) }}
              </p>
            </div>
            <div class="mt-auto flex flex-col gap-2">
              <button
                v-for="quantity in QUANTITIES"
                :key="quantity"
                type="button"
                class="flex items-center justify-between gap-2 rounded-xl bg-night-800 px-3 py-2 text-sm font-semibold whitespace-nowrap transition hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canOpen(tier, quantity)"
                :data-testid="`open-${tier.key}-${quantity}`"
                @click="openBoosters(tier, quantity)"
              >
                <span>{{ t('boosters.open', { count: quantity }) }}</span>
                <span class="text-gold-400 tabular-nums">
                  {{ t('nav.gems', { count: n((tier.priceGems ?? 0) * quantity, 'integer') }) }}
                </span>
              </button>
            </div>
            <p v-if="errorMessage && lastTier === tier.key" :class="playerUi.error" role="alert">
              {{ errorMessage }}
            </p>
            <TierRates :tier="tier" />
          </li>
        </ul>
      </section>

      <BoosterOpening
        v-if="opening"
        :result="opening.result"
        :pack-label="opening.label"
        :pack-art="opening.art"
        :pack-color="opening.color"
        :pack-seal="opening.seal"
        @close="opening = null"
      />
    </RequireSignIn>
  </main>
</template>
