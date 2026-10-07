<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGemHistoryQuery } from '@/api/player'
import PaginationBar from '@/components/PaginationBar.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const { t, n, d } = useI18n()
const page = ref(1)
const history = useGemHistoryQuery(page)
const data = computed(() => history.data.value)
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('gems.title') }}</h1>
          <p class="text-mist-300">{{ t('gems.subtitle') }}</p>
        </div>
        <p
          v-if="data"
          class="font-display text-3xl font-bold text-gold-400 tabular-nums"
          data-testid="gem-balance"
        >
          {{ t('nav.gems', { count: n(data.gemBalance, 'integer') }) }}
        </p>
      </header>

      <p v-if="history.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="data && data.items.length === 0" :class="playerUi.panel">
        {{ t('gems.empty') }}
      </p>
      <div v-else-if="data" class="overflow-x-auto rounded-2xl border border-night-700">
        <table class="w-full text-left text-sm">
          <thead class="bg-night-900 text-xs tracking-wide text-mist-300 uppercase">
            <tr>
              <th class="px-4 py-2">{{ t('gems.columns.date') }}</th>
              <th class="px-4 py-2">{{ t('gems.columns.reason') }}</th>
              <th class="px-4 py-2 text-right">{{ t('gems.columns.amount') }}</th>
              <th class="px-4 py-2 text-right">{{ t('gems.columns.balance') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.items" :key="item.id" class="border-t border-night-800">
              <td class="px-4 py-2 text-mist-300">{{ d(new Date(item.createdAt), 'long') }}</td>
              <td class="px-4 py-2">{{ t(`gems.reasons.${item.reason}`) }}</td>
              <td
                class="px-4 py-2 text-right font-semibold tabular-nums"
                :class="item.amount > 0 ? 'text-emerald-400' : 'text-rarity-mythic'"
              >
                {{ n(item.amount, 'signed') }}
              </td>
              <td class="px-4 py-2 text-right tabular-nums">
                {{ n(item.balanceAfter, 'integer') }}
              </td>
            </tr>
          </tbody>
        </table>
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
