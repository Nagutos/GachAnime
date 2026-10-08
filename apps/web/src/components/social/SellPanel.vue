<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useCreateListingMutation, useMarketRulesQuery } from '@/api/social'
import { useErrorMessage } from '@/app/errors'
import { playerUi } from '@/components/ui'

/** Sell one copy of a character on the market (wiki entry). */
const props = defineProps<{
  characterId: number
  rarityKey: string
  quantity: number
  lockedQuantity: number
}>()
const { t, n } = useI18n()
const rules = useMarketRulesQuery()
const create = useCreateListingMutation()
const errorMessage = useErrorMessage(create.error)
const bounds = computed(() =>
  rules.data.value?.priceBounds.find((b) => b.rarityKey === props.rarityKey),
)
const price = ref<number | null>(null)
const listed = ref(false)
const free = computed(() => props.quantity - props.lockedQuantity)
const lastCopy = computed(() => props.quantity === 1)

async function sell(): Promise<void> {
  if (!price.value) return
  listed.value = false
  const result = await create
    .mutateAsync({ characterId: props.characterId, price: price.value })
    .catch(() => null)
  if (result) {
    listed.value = true
    price.value = null
  }
}
</script>

<template>
  <section :class="[playerUi.panel, 'flex flex-col gap-3']" data-testid="sell-panel">
    <h2 class="font-display text-lg font-bold">{{ t('market.sellTitle') }}</h2>
    <p v-if="free < 1" class="text-sm text-mist-300">{{ t('market.allLocked') }}</p>
    <template v-else>
      <p v-if="bounds" class="text-sm text-mist-300">
        {{
          bounds.max
            ? t('market.bounds', { min: n(bounds.min, 'integer'), max: n(bounds.max, 'integer') })
            : t('market.boundsMin', { min: n(bounds.min, 'integer') })
        }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model.number="price"
          type="number"
          :min="bounds?.min ?? 1"
          :max="bounds?.max || undefined"
          :class="[playerUi.input, 'w-32']"
          :placeholder="t('market.price')"
          :aria-label="t('market.price')"
          data-testid="sell-price"
        />
        <button
          type="button"
          class="rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700 disabled:opacity-50"
          :disabled="!price || create.isPending.value"
          data-testid="sell-button"
          @click="sell"
        >
          {{ t('market.sell') }}
        </button>
      </div>
      <p
        v-if="lastCopy"
        class="rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-sm text-gold-400"
        role="alert"
      >
        {{ t('market.lastCopyWarning') }}
      </p>
    </template>
    <p v-if="listed" class="text-sm text-emerald-400" role="status">
      {{ t('market.listed') }}
      <RouterLink :to="{ name: 'market' }" class="underline">{{
        t('market.seeMarket')
      }}</RouterLink>
    </p>
    <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
  </section>
</template>
