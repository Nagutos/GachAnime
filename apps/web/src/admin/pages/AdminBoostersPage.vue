<script setup lang="ts">
import { RATE_TABLE_TOTAL, type AdminBoosterTier } from '@gachanime/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminRaritiesQuery, useAdminTiersQuery, useUpdateTierMutation } from '@/api/admin'
import { useErrorMessage } from '@/app/errors'
import { cleanLocalized } from '../text'
import { rarityClasses, ui } from '../ui'

const CARDS_PER_BOOSTER = 5

const { t, n } = useI18n()
const tiers = useAdminTiersQuery()
const rarities = useAdminRaritiesQuery()
const update = useUpdateTierMutation()
const errorMessage = useErrorMessage(update.error)
const savedKey = ref<string | null>(null)

const rarityList = computed(() => rarities.data.value?.rarities ?? [])
const drafts = ref<Record<string, AdminBoosterTier>>({})
watch(
  () => tiers.data.value,
  (value) => {
    if (!value) return
    drafts.value = Object.fromEntries(
      value.tiers.map((tier) => [tier.key, JSON.parse(JSON.stringify(tier)) as AdminBoosterTier]),
    )
  },
  { immediate: true },
)

function sumOf(tier: AdminBoosterTier): number {
  return Object.values(tier.weights).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

/** Display only: chance of at least one card of this rarity in a booster. */
function perBooster(weight: number): number {
  return 1 - (1 - weight / RATE_TABLE_TOTAL) ** CARDS_PER_BOOSTER
}

async function save(key: string): Promise<void> {
  const draft = drafts.value[key]!
  savedKey.value = null
  const weights = Object.fromEntries(
    rarityList.value.map((rarity) => [rarity.key, Number(draft.weights[rarity.key]) || 0]),
  )
  await update.mutateAsync({
    key,
    changes: {
      name: cleanLocalized(draft.name),
      description: draft.description ? cleanLocalized(draft.description) : null,
      weights,
      isActive: draft.isActive,
      sortOrder: draft.sortOrder,
      ...(draft.priceGems === null ? {} : { priceGems: draft.priceGems }),
    },
  })
  savedKey.value = key
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="font-display text-3xl font-bold">{{ t('admin.boosters.title') }}</h1>
      <p class="text-mist-300">{{ t('admin.boosters.help') }}</p>
    </div>
    <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
    <p v-if="tiers.isPending.value || rarities.isPending.value" class="text-mist-300">
      {{ t('common.loading') }}
    </p>
    <form
      v-for="tier in tiers.data.value?.tiers ?? []"
      v-else
      :key="tier.key"
      :class="[ui.card, 'flex flex-col gap-4']"
      :data-testid="`tier-form-${tier.key}`"
      @submit.prevent="save(tier.key)"
    >
      <template v-if="drafts[tier.key]">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-display text-xl font-bold">
            {{ tier.key }}
            <span class="ml-2 text-sm font-normal text-mist-300">
              {{ t('admin.boosters.openings', { count: n(tier.openings, 'integer') }) }}
            </span>
          </h2>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="drafts[tier.key]!.isActive" type="checkbox" class="accent-sakura-500" />
            {{ t('admin.common.active') }}
          </label>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label :class="ui.label">
            {{ t('admin.boosters.nameEn') }}
            <input v-model.trim="drafts[tier.key]!.name.en" :class="ui.input" />
          </label>
          <label :class="ui.label">
            {{ t('admin.boosters.nameFr') }}
            <input v-model.trim="drafts[tier.key]!.name.fr" :class="ui.input" />
          </label>
          <label v-if="drafts[tier.key]!.priceGems !== null" :class="ui.label">
            {{ t('admin.boosters.price') }}
            <input
              v-model.number="drafts[tier.key]!.priceGems"
              type="number"
              min="1"
              :class="ui.input"
            />
          </label>
          <p v-else class="self-end pb-2 text-sm text-mist-300">
            {{ t('admin.boosters.freeTier') }}
          </p>
          <label :class="ui.label">
            {{ t('admin.boosters.sortOrder') }}
            <input
              v-model.number="drafts[tier.key]!.sortOrder"
              type="number"
              min="0"
              :class="ui.input"
            />
          </label>
        </div>
        <div class="overflow-x-auto">
          <table :class="ui.table">
            <thead>
              <tr>
                <th :class="ui.th">{{ t('admin.boosters.rarity') }}</th>
                <th :class="ui.th">{{ t('admin.boosters.weight') }}</th>
                <th :class="[ui.th, 'text-right']">{{ t('admin.boosters.perCard') }}</th>
                <th :class="[ui.th, 'text-right']">{{ t('admin.boosters.perBooster') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rarity in rarityList" :key="rarity.key" class="border-t border-night-800">
                <td :class="ui.td">
                  <span
                    class="rounded-full border px-2 py-0.5 text-xs font-semibold"
                    :class="rarityClasses[rarity.colorToken]"
                  >
                    {{ rarity.key }}
                  </span>
                </td>
                <td :class="ui.td">
                  <input
                    v-model.number="drafts[tier.key]!.weights[rarity.key]"
                    type="number"
                    min="0"
                    step="1"
                    :class="[ui.input, 'w-32']"
                    :aria-label="t('admin.boosters.weightOf', { rarity: rarity.key })"
                  />
                </td>
                <td :class="[ui.td, 'text-right tabular-nums']">
                  {{ n((drafts[tier.key]!.weights[rarity.key] ?? 0) / RATE_TABLE_TOTAL, 'rate') }}
                </td>
                <td :class="[ui.td, 'text-right tabular-nums']">
                  {{ n(perBooster(drafts[tier.key]!.weights[rarity.key] ?? 0), 'rate') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p
            class="text-sm tabular-nums"
            :class="
              sumOf(drafts[tier.key]!) === RATE_TABLE_TOTAL
                ? 'text-emerald-400'
                : 'text-rarity-mythic'
            "
            data-testid="weights-sum"
          >
            {{
              t('admin.boosters.sum', {
                sum: n(sumOf(drafts[tier.key]!), 'integer'),
                total: n(RATE_TABLE_TOTAL, 'integer'),
              })
            }}
          </p>
          <div class="flex items-center gap-3">
            <span v-if="savedKey === tier.key" class="text-sm text-emerald-400">
              {{ t('admin.common.saved') }}
            </span>
            <button
              type="submit"
              :class="ui.buttonPrimary"
              :disabled="update.isPending.value || sumOf(drafts[tier.key]!) !== RATE_TABLE_TOTAL"
            >
              {{ t('admin.common.save') }}
            </button>
          </div>
        </div>
      </template>
    </form>
  </div>
</template>
