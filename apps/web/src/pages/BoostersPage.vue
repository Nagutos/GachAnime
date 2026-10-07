<script setup lang="ts">
import {
  resolveLocalizedText,
  THEME_CATEGORIES,
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
  ribbon: string | null
} | null>(null)

/** Selected pack (theme key); null = the whole catalog. */
const themeKey = ref<string | null>(null)
const selectedTheme = computed<ThemeDto | null>(
  () => data.value?.themes.find((theme) => theme.key === themeKey.value) ?? null,
)
const themeGroups = computed(() =>
  THEME_CATEGORIES.map((category) => ({
    category,
    themes: (data.value?.themes ?? []).filter((theme) => theme.category === category),
  })).filter((group) => group.themes.length > 0),
)
const freeAvailable = computed(() => !selectedTheme.value || selectedTheme.value.freeEnabled)
const paidAvailable = computed(() => !selectedTheme.value || selectedTheme.value.paidEnabled)

function tierName(tier: BoosterTierDto): string {
  return resolveLocalizedText(tier.name, locale.value)
}

function themeName(theme: ThemeDto | null): string | null {
  return theme ? resolveLocalizedText(theme.name, locale.value) : null
}

/** Price of one booster: the server gives the pack prices (surcharge included). */
function unitPrice(tier: BoosterTierDto): number {
  return selectedTheme.value?.prices[tier.key] ?? tier.priceGems ?? 0
}

/** Display only: the server checks charges and gems again. */
function canOpen(tier: BoosterTierDto, quantity: BoosterQuantity): boolean {
  if (open.isPending.value || !data.value) return false
  if (tier.priceGems === null) {
    return freeAvailable.value && (free.value?.available ?? 0) >= quantity
  }
  return paidAvailable.value && data.value.gemBalance >= unitPrice(tier) * quantity
}

async function openBoosters(tier: BoosterTierDto, quantity: BoosterQuantity): Promise<void> {
  lastTier.value = tier.key
  const theme = selectedTheme.value
  const result = await open
    .mutateAsync({ tier: tier.key, quantity, theme: theme?.key })
    .catch(() => null)
  if (result) {
    opening.value = { result, label: tierName(tier), art: tier.artToken, ribbon: themeName(theme) }
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

      <section
        v-if="themeGroups.length"
        :class="[playerUi.panel, 'flex flex-col gap-3']"
        data-testid="pack-selector"
      >
        <div>
          <h2 class="font-display text-lg font-bold">{{ t('boosters.packs.title') }}</h2>
          <p class="text-sm text-mist-300">{{ t('boosters.packs.help') }}</p>
        </div>
        <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('boosters.packs.title')">
          <button
            type="button"
            role="radio"
            :aria-checked="themeKey === null"
            class="rounded-full border px-3 py-1.5 text-sm"
            :class="
              themeKey === null
                ? 'border-sakura-400 bg-sakura-400/15 text-mist-100'
                : 'border-night-700 text-mist-300 hover:text-mist-100'
            "
            data-testid="pack-all"
            @click="themeKey = null"
          >
            {{ t('boosters.packs.all') }}
          </button>
          <template v-for="group in themeGroups" :key="group.category">
            <span class="self-center pl-2 text-xs tracking-wide text-mist-300 uppercase">
              {{ t(`boosters.packs.categories.${group.category}`) }}
            </span>
            <button
              v-for="theme in group.themes"
              :key="theme.key"
              type="button"
              role="radio"
              :aria-checked="themeKey === theme.key"
              class="rounded-full border px-3 py-1.5 text-sm"
              :class="
                themeKey === theme.key
                  ? 'border-sakura-400 bg-sakura-400/15 text-mist-100'
                  : 'border-night-700 text-mist-300 hover:text-mist-100'
              "
              :title="
                theme.description ? resolveLocalizedText(theme.description, locale) : undefined
              "
              :data-testid="`pack-${theme.key}`"
              @click="themeKey = theme.key"
            >
              {{ resolveLocalizedText(theme.name, locale) }}
              <span class="text-xs text-mist-300 tabular-nums">
                {{ n(theme.characterCount, 'integer') }}
              </span>
            </button>
          </template>
        </div>
        <p v-if="selectedTheme" class="text-sm text-mist-300" data-testid="pack-summary">
          <template v-if="selectedTheme.paidEnabled && selectedTheme.surchargePercent > 0">
            {{ t('boosters.packs.surcharge', { percent: selectedTheme.surchargePercent }) }}
          </template>
          <template v-if="!selectedTheme.freeEnabled">{{ t('boosters.packs.noFree') }}</template>
          <template v-if="!selectedTheme.paidEnabled">{{ t('boosters.packs.noPaid') }}</template>
        </p>
      </section>

      <p v-if="boosters.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="data && data.tiers.length === 0" :class="playerUi.panel">
        {{ t('boosters.noTier') }}
      </p>

      <section
        v-for="tier in freeTiers"
        :key="tier.key"
        :class="[playerUi.panel, 'flex flex-col gap-6 md:flex-row md:items-center']"
        :data-testid="`tier-${tier.key}`"
      >
        <div class="mx-auto w-40 shrink-0 md:mx-0 md:w-48">
          <BoosterPack
            :label="tierName(tier)"
            :cards="data!.cardsPerBooster"
            :art="tier.artToken"
            :ribbon="themeName(selectedTheme)"
            idle
          />
        </div>

        <div class="flex flex-1 flex-col gap-4">
          <div>
            <h2 class="font-display text-2xl font-bold">{{ tierName(tier) }}</h2>
            <p v-if="selectedTheme?.description" class="text-mist-300">
              {{ resolveLocalizedText(selectedTheme.description, locale) }}
            </p>
            <p v-else-if="tier.description" class="text-mist-300">
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
                :ribbon="themeName(selectedTheme)"
              />
            </div>
            <div class="text-center">
              <h3 class="font-display text-xl font-bold">{{ tierName(tier) }}</h3>
              <p v-if="tier.description" class="text-sm text-mist-300">
                {{ resolveLocalizedText(tier.description, locale) }}
              </p>
              <p class="mt-2 font-semibold text-gold-400 tabular-nums">
                {{ t('boosters.pricePerPack', { price: n(unitPrice(tier), 'integer') }) }}
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
                  {{ t('nav.gems', { count: n(unitPrice(tier) * quantity, 'integer') }) }}
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
        :pack-ribbon="opening.ribbon"
        @close="opening = null"
      />
    </RequireSignIn>
  </main>
</template>
