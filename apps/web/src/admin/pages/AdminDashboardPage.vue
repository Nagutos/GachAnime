<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useRarities } from '../use-rarities'
import { rarityBarClasses, ui } from '../ui'

const { t, n } = useI18n()
const { stats, nameOf } = useRarities()

const totals = computed(() => stats.data.value?.totals)
const activeCount = computed(() =>
  (stats.data.value?.rarities ?? []).reduce((sum, rarity) => sum + rarity.characterCount, 0),
)
const tiles = computed(() =>
  totals.value
    ? ([
        ['characters', totals.value.characters],
        ['drawable', totals.value.drawable],
        ['series', totals.value.series],
        ['activeSeries', totals.value.activeSeries],
      ] as const)
    : [],
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="font-display text-3xl font-bold">{{ t('admin.dashboard.title') }}</h1>
    <p v-if="stats.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <template v-else-if="totals">
      <div v-if="totals.characters === 0" :class="[ui.card, 'flex flex-col items-start gap-3']">
        <p>{{ t('admin.dashboard.emptyCatalog') }}</p>
        <RouterLink :to="{ name: 'admin-imports' }" :class="ui.buttonPrimary">
          {{ t('admin.dashboard.startImport') }}
        </RouterLink>
      </div>
      <dl class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div v-for="[key, value] in tiles" :key="key" :class="ui.card" :data-testid="`stat-${key}`">
          <dt class="text-sm text-mist-300">{{ t(`admin.dashboard.${key}`) }}</dt>
          <dd class="font-display text-3xl font-bold tabular-nums">{{ n(value, 'integer') }}</dd>
        </div>
      </dl>
      <div
        v-if="totals.unclassifiedGender > 0"
        :class="[ui.card, 'flex flex-wrap items-center justify-between gap-3']"
      >
        <p>
          {{ t('admin.dashboard.unclassified') }} ·
          <strong class="tabular-nums">{{ n(totals.unclassifiedGender, 'integer') }}</strong>
        </p>
        <RouterLink
          :to="{ name: 'admin-characters', query: { gender: 'unclassified' } }"
          :class="ui.button"
        >
          {{ t('admin.dashboard.unclassifiedLink') }}
        </RouterLink>
      </div>
      <section :class="[ui.card, 'flex flex-col gap-4']">
        <div>
          <h2 class="font-display text-xl font-bold">
            {{ t('admin.dashboard.rarityDistribution') }}
          </h2>
          <p class="text-sm text-mist-300">{{ t('admin.dashboard.rarityHelp') }}</p>
        </div>
        <ul class="flex flex-col gap-3">
          <li
            v-for="rarity in stats.data.value?.rarities ?? []"
            :key="rarity.key"
            class="flex flex-col gap-1"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <RouterLink
                :to="{ name: 'admin-characters', query: { rarity: rarity.key } }"
                class="font-semibold hover:text-sakura-400"
              >
                {{ nameOf(rarity.key) }}
              </RouterLink>
              <span class="text-mist-300">
                {{
                  t('admin.dashboard.threshold', {
                    count: n(rarity.favouritesThreshold, 'integer'),
                  })
                }}
                ·
                {{
                  t('admin.dashboard.overridden', { count: n(rarity.overriddenCount, 'integer') })
                }}
              </span>
              <span class="tabular-nums">
                {{ n(rarity.characterCount, 'integer') }} ·
                {{ n(activeCount ? rarity.characterCount / activeCount : 0, 'percent') }}
              </span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-night-800">
              <div
                class="h-full rounded-full"
                :class="rarityBarClasses[rarity.colorToken] ?? 'bg-night-500'"
                :style="{
                  width: `${activeCount ? (rarity.characterCount / activeCount) * 100 : 0}%`,
                }"
              />
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
