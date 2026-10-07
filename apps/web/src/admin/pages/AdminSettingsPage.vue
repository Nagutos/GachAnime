<script setup lang="ts">
import type { AdminSettings } from '@gachanime/shared'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminSettingsQuery, useUpdateSettingMutation } from '@/api/admin'
import { useErrorMessage } from '@/app/errors'
import { ui } from '../ui'

const { t } = useI18n()
const settings = useAdminSettingsQuery()
const update = useUpdateSettingMutation()
const errorMessage = useErrorMessage(update.error)
const saved = ref<string | null>(null)

const free = ref<AdminSettings['boosters.free']>({ intervalSeconds: 600, maxCharges: 15 })
const reset = ref<AdminSettings['missions.reset']>({ hour: 0, timeZone: 'Europe/Paris' })
const market = ref<AdminSettings['market.limits']>({
  maxActiveListings: 20,
  maxSalesPerDay: 20,
  maxPurchasesPerDay: 20,
  listingTtlDays: 7,
})
const tradeOffers = ref<AdminSettings['trades.offers']>({ offerTtlDays: 0 })
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
    reset.value = { ...value['missions.reset'] }
    market.value = { ...value['market.limits'] }
    tradeOffers.value = { ...value['trades.offers'] }
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
    </template>
  </div>
</template>
