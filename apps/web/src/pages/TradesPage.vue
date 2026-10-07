<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useTradesQuery } from '@/api/social'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import TradeCard from '@/components/social/TradeCard.vue'
import { playerUi } from '@/components/ui'

const BOXES = ['incoming', 'outgoing', 'history'] as const
const { t } = useI18n()
const box = ref<(typeof BOXES)[number]>('incoming')
const page = ref(1)
watch(box, () => (page.value = 1))
const trades = useTradesQuery(computed(() => ({ page: page.value, box: box.value })))
const data = computed(() => trades.data.value)
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
          class="rounded-xl bg-sakura-500 px-4 py-2 font-semibold text-white hover:bg-sakura-600"
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
      <p v-if="trades.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="data && data.items.length === 0" :class="playerUi.panel">
        {{ t(`trades.empty.${box}`) }}
      </p>
      <div v-else-if="data" class="flex flex-col gap-4">
        <TradeCard v-for="trade in data.items" :key="trade.id" :trade="trade" />
      </div>
      <PaginationBar
        v-if="data"
        :page="page"
        :page-size="data.pageSize"
        :total="data.total"
        @update:page="(value: number) => (page = value)"
      />
    </RequireSignIn>
  </main>
</template>
