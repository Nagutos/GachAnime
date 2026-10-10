<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { usePublicTradesQuery, useTradesQuery } from '@/api/social'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import PublicTradeCard from '@/components/social/PublicTradeCard.vue'
import TradeCard from '@/components/social/TradeCard.vue'
import { playerUi } from '@/components/ui'

/** `others`: pending trades between other players, read only. */
const BOXES = ['incoming', 'outgoing', 'history', 'others'] as const
const { t } = useI18n()
const box = ref<(typeof BOXES)[number]>('incoming')
const page = ref(1)
watch(box, () => (page.value = 1))
const watching = computed(() => box.value === 'others')
const trades = useTradesQuery(
  computed(() => ({
    page: watching.value ? 1 : page.value,
    box: box.value === 'others' ? 'incoming' : box.value,
  })),
)
const publicTrades = usePublicTradesQuery(page, watching)
const data = computed(() => trades.data.value)
const shown = computed(() => (watching.value ? publicTrades.data.value : data.value))
const pending = computed(() =>
  watching.value ? publicTrades.isPending.value : trades.isPending.value,
)
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('trades.title') }}</h1>
          <p class="text-mist-300">{{ t('trades.subtitle') }}</p>
        </div>
        <RouterLink
          :to="{ name: 'players' }"
          class="rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700"
        >
          {{ t('trades.new') }}
        </RouterLink>
      </header>
      <div class="flex gap-1 border-b border-night-700" role="tablist">
        <button
          v-for="value in BOXES"
          :key="value"
          type="button"
          role="tab"
          :aria-selected="box === value"
          class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
          :class="
            box === value
              ? 'border-sakura-400 text-mist-100'
              : 'border-transparent text-mist-300 hover:text-mist-100'
          "
          :data-testid="`trades-${value}`"
          @click="box = value"
        >
          {{ t(`trades.boxes.${value}`) }}
          <span
            v-if="value === 'incoming' && data?.pendingIncoming"
            class="ml-1 rounded-full bg-gold-400 px-1.5 text-xs font-bold text-night-950"
          >
            {{ data.pendingIncoming }}
          </span>
        </button>
      </div>
      <p v-if="watching" class="text-sm text-mist-300">{{ t('trades.public.help') }}</p>
      <p v-if="pending" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="shown && shown.items.length === 0" :class="playerUi.panel">
        {{ t(`trades.empty.${box}`) }}
      </p>
      <div v-else-if="watching && publicTrades.data.value" class="flex flex-col gap-4">
        <PublicTradeCard
          v-for="trade in publicTrades.data.value.items"
          :key="trade.id"
          :trade="trade"
        />
      </div>
      <div v-else-if="data" class="flex flex-col gap-4">
        <TradeCard v-for="trade in data.items" :key="trade.id" :trade="trade" />
      </div>
      <PaginationBar
        v-if="shown"
        :page="page"
        :page-size="shown.pageSize"
        :total="shown.total"
        @update:page="(value: number) => (page = value)"
      />
    </RequireSignIn>
  </main>
</template>
