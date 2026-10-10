<script setup lang="ts">
import type { AdminSettings } from '@gachanime/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminSettingsQuery, useUpdateSettingMutation } from '@/api/admin'
import { useErrorMessage } from '@/app/errors'
import { usePlayerRarities } from '@/app/rarities'
import AppSelect from '@/components/AppSelect.vue'
import UpgradeLevelsEditor from '../components/UpgradeLevelsEditor.vue'
import { ui } from '../ui'

const { t } = useI18n()
const settings = useAdminSettingsQuery()
const update = useUpdateSettingMutation()
const errorMessage = useErrorMessage(update.error)
const saved = ref<string | null>(null)

const free = ref<AdminSettings['boosters.free']>({ intervalSeconds: 600, maxCharges: 15 })
const weekly = ref<AdminSettings['boosters.weekly']>({
  enabled: true,
  rareMultiplier: 1.5,
  boostedFrom: 'epic',
  minCharacters: 40,
  tagMinRank: 60,
  topSeries: 100,
  cooldownWeeks: 4,
})
const weeklyFields = ['minCharacters', 'tagMinRank', 'topSeries', 'cooldownWeeks'] as const
const { rarities, nameOf } = usePlayerRarities()
const rarityOptions = computed(() =>
  rarities.value.map((rarity) => ({ value: rarity.key, label: nameOf(rarity.key) })),
)
const reset = ref<AdminSettings['missions.reset']>({ hour: 0, timeZone: 'Europe/Paris' })
const market = ref<AdminSettings['market.limits']>({
  maxActiveListings: 20,
  maxSalesPerDay: 20,
  maxPurchasesPerDay: 20,
  listingTtlDays: 7,
})
const tradeOffers = ref<AdminSettings['trades.offers']>({ offerTtlDays: 0 })
const wishlist = ref<AdminSettings['wishlist']>({ maxItems: 20, boostPercent: 5 })
const favorites = ref<AdminSettings['favorites']>({ maxItems: 100 })
const recycle = ref<AdminSettings['recycle']>({ multiplier: 1 })
const upgradeForms = [
  { key: 'upgrades.boosterStorage', name: 'boosterStorage', min: 1, max: 1000, step: 1 },
  { key: 'upgrades.boosterSpeed', name: 'boosterSpeed', min: 1, max: 90, step: 1 },
  { key: 'upgrades.recycleBonus', name: 'recycleBonus', min: 1, max: 100, step: 0.01 },
] as const
type UpgradeSettingKey = (typeof upgradeForms)[number]['key']
const upgrades = ref<Record<UpgradeSettingKey, AdminSettings[UpgradeSettingKey]>>({
  'upgrades.boosterStorage': { levels: [] },
  'upgrades.boosterSpeed': { levels: [] },
  'upgrades.recycleBonus': { levels: [] },
})
const imageCache = ref<AdminSettings['images.cache']>({ enabled: false })
const adultImports = ref<AdminSettings['imports.adult']>({ allowed: false })
const marketFields = [
  'maxActiveListings',
  'maxSalesPerDay',
  'maxPurchasesPerDay',
  'listingTtlDays',
] as const
watch(
  () => settings.data.value,
  (value) => {
    if (!value) return
    free.value = { ...value['boosters.free'] }
    weekly.value = { ...value['boosters.weekly'] }
    reset.value = { ...value['missions.reset'] }
    market.value = { ...value['market.limits'] }
    tradeOffers.value = { ...value['trades.offers'] }
    wishlist.value = { ...value.wishlist }
    favorites.value = { ...value.favorites }
    recycle.value = { ...value.recycle }
    for (const form of upgradeForms) {
      upgrades.value[form.key] = {
        levels: value[form.key].levels.map((level) => ({ ...level })),
      }
    }
    imageCache.value = { ...value['images.cache'] }
    adultImports.value = { ...value['imports.adult'] }
  },
  { immediate: true },
)

async function save<K extends keyof AdminSettings>(key: K, value: AdminSettings[K]): Promise<void> {
  saved.value = null
  await update.mutateAsync({ key, value })
  saved.value = key
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="font-display text-3xl font-bold">{{ t('admin.settings.title') }}</h1>
    <p v-if="settings.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <template v-else>
      <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
      <form :class="[ui.card, 'flex flex-col gap-4']" @submit.prevent="save('boosters.free', free)">
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.freeBoosters') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label :class="ui.label">
            {{ t('admin.settings.intervalMinutes') }}
            <input
              :value="free.intervalSeconds / 60"
              type="number"
              min="1"
              step="1"
              :class="ui.input"
              @input="
                free.intervalSeconds =
                  Math.round(Number(($event.target as HTMLInputElement).value) * 60) || 60
              "
            />
          </label>
          <label :class="ui.label">
            {{ t('admin.settings.maxCharges') }}
            <input
              v-model.number="free.maxCharges"
              type="number"
              min="1"
              max="1000"
              :class="ui.input"
            />
          </label>
        </div>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'boosters.free'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form
        :class="[ui.card, 'flex flex-col gap-4']"
        data-testid="weekly-settings"
        @submit.prevent="save('boosters.weekly', weekly)"
      >
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.weekly.title') }}</h2>
        <p class="text-sm text-mist-300">{{ t('admin.settings.weekly.help') }}</p>
        <label class="flex items-center gap-2">
          <input v-model="weekly.enabled" type="checkbox" class="size-4 accent-sakura-500" />
          {{ t('admin.settings.weekly.enabled') }}
        </label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label :class="ui.label">
            {{ t('admin.settings.weekly.rareMultiplier') }}
            <input
              v-model.number="weekly.rareMultiplier"
              type="number"
              min="1"
              max="10"
              step="0.05"
              :class="ui.input"
            />
          </label>
          <div :class="ui.label">
            {{ t('admin.settings.weekly.boostedFrom') }}
            <AppSelect
              v-model="weekly.boostedFrom"
              :options="rarityOptions"
              :aria-label="t('admin.settings.weekly.boostedFrom')"
            />
          </div>
          <label v-for="field in weeklyFields" :key="field" :class="ui.label">
            {{ t(`admin.settings.weekly.${field}`) }}
            <input v-model.number="weekly[field]" type="number" min="0" :class="ui.input" />
          </label>
        </div>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'boosters.weekly'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form :class="[ui.card, 'flex flex-col gap-4']" @submit.prevent="save('recycle', recycle)">
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.recycle') }}</h2>
        <p class="text-sm text-mist-300">{{ t('admin.settings.recycleHelp') }}</p>
        <label :class="ui.label">
          {{ t('admin.settings.recycleMultiplier') }}
          <input
            v-model.number="recycle.multiplier"
            type="number"
            min="0"
            max="100"
            step="0.01"
            :class="ui.input"
            data-testid="setting-recycle-multiplier"
          />
        </label>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'recycle'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form
        v-for="form in upgradeForms"
        :key="form.key"
        :class="[ui.card, 'flex flex-col gap-4']"
        @submit.prevent="save(form.key, upgrades[form.key])"
      >
        <h2 class="font-display text-xl font-bold">
          {{ t(`admin.settings.upgrades.${form.name}.title`) }}
        </h2>
        <p class="text-sm text-mist-300">{{ t(`admin.settings.upgrades.${form.name}.help`) }}</p>
        <UpgradeLevelsEditor
          v-model="upgrades[form.key].levels"
          :value-label="t(`admin.settings.upgrades.${form.name}.value`)"
          :min="form.min"
          :max="form.max"
          :step="form.step"
          :testid="`setting-${form.name}`"
        />
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === form.key" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form :class="[ui.card, 'flex flex-col gap-4']" @submit.prevent="save('wishlist', wishlist)">
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.wishlist') }}</h2>
        <p class="text-sm text-mist-300">{{ t('admin.settings.wishlistHelp') }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label :class="ui.label">
            {{ t('admin.settings.wishlistMaxItems') }}
            <input
              v-model.number="wishlist.maxItems"
              type="number"
              min="1"
              max="200"
              :class="ui.input"
              data-testid="setting-wishlist-max"
            />
          </label>
          <label :class="ui.label">
            {{ t('admin.settings.wishlistBoostPercent') }}
            <input
              v-model.number="wishlist.boostPercent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              :class="ui.input"
              data-testid="setting-wishlist-boost"
            />
          </label>
        </div>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'wishlist'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form
        :class="[ui.card, 'flex flex-col gap-4']"
        @submit.prevent="save('favorites', favorites)"
      >
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.favorites') }}</h2>
        <label :class="ui.label">
          {{ t('admin.settings.favoritesMaxItems') }}
          <input
            v-model.number="favorites.maxItems"
            type="number"
            min="1"
            max="500"
            :class="ui.input"
            data-testid="setting-favorites-max"
          />
        </label>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'favorites'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form
        :class="[ui.card, 'flex flex-col gap-4']"
        @submit.prevent="save('missions.reset', reset)"
      >
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.dailyReset') }}</h2>
        <p class="text-sm text-mist-300">{{ t('admin.settings.dailyResetHelp') }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label :class="ui.label">
            {{ t('admin.settings.resetHour') }}
            <input v-model.number="reset.hour" type="number" min="0" max="23" :class="ui.input" />
          </label>
          <label :class="ui.label">
            {{ t('admin.settings.timeZone') }}
            <input v-model.trim="reset.timeZone" type="text" :class="ui.input" />
          </label>
        </div>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'missions.reset'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>
      <form
        :class="[ui.card, 'flex flex-col gap-4']"
        @submit.prevent="save('market.limits', market)"
      >
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.market') }}</h2>
        <p class="text-sm text-mist-300">{{ t('admin.settings.zeroUnlimited') }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label v-for="field in marketFields" :key="field" :class="ui.label">
            {{ t(`admin.settings.marketFields.${field}`) }}
            <input v-model.number="market[field]" type="number" min="0" :class="ui.input" />
          </label>
        </div>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'market.limits'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form
        :class="[ui.card, 'flex flex-col gap-4']"
        @submit.prevent="save('trades.offers', tradeOffers)"
      >
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.trades') }}</h2>
        <label :class="ui.label">
          {{ t('admin.settings.offerTtlDays') }}
          <input
            v-model.number="tradeOffers.offerTtlDays"
            type="number"
            min="0"
            :class="ui.input"
          />
        </label>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'trades.offers'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form
        :class="[ui.card, 'flex flex-col gap-4']"
        @submit.prevent="save('images.cache', imageCache)"
      >
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.imageCache') }}</h2>
        <p class="text-sm text-mist-300">{{ t('admin.settings.imageCacheHelp') }}</p>
        <label class="flex items-center gap-2">
          <input
            v-model="imageCache.enabled"
            type="checkbox"
            data-testid="image-cache-enabled"
            class="size-4 accent-sakura-500"
          />
          {{ t('admin.settings.imageCacheEnabled') }}
        </label>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'images.cache'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>

      <form
        :class="[ui.card, 'flex flex-col gap-4']"
        @submit.prevent="save('imports.adult', adultImports)"
      >
        <h2 class="font-display text-xl font-bold">{{ t('admin.settings.adultImports') }}</h2>
        <p class="text-sm text-mist-300">{{ t('admin.settings.adultImportsHelp') }}</p>
        <label class="flex items-center gap-2">
          <input
            v-model="adultImports.allowed"
            type="checkbox"
            data-testid="adult-imports-allowed"
            class="size-4 accent-sakura-500"
          />
          {{ t('admin.settings.adultImportsAllowed') }}
        </label>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved === 'imports.adult'" class="text-sm text-emerald-400">
            {{ t('admin.common.saved') }}
          </span>
          <button type="submit" :class="ui.buttonPrimary" :disabled="update.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
