<script setup lang="ts">
import type { UpgradeDto, UpgradeKey } from '@gachanime/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useBuyUpgradeMutation, useUpgradesQuery } from '@/api/player'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const { t, n } = useI18n()
const upgrades = useUpgradesQuery()
const buy = useBuyUpgradeMutation()
const data = computed(() => upgrades.data.value)

/** Effect of a level as shown to the player (the server applies it). */
function effect(key: UpgradeKey, value: number | null): string {
  if (key === 'booster_storage') return t('upgrades.effects.booster_storage', { count: value ?? 0 })
  if (key === 'booster_speed') return t('upgrades.effects.booster_speed', { percent: value ?? 0 })
  return t('upgrades.effects.recycle_bonus', { multiplier: n(value ?? 1, 'decimal') })
}

function canAfford(upgrade: UpgradeDto): boolean {
  return Boolean(upgrade.next && data.value && data.value.gemBalance >= upgrade.next.cost)
}

function minutes(seconds: number): string {
  return n(seconds / 60, 'decimal')
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('upgrades.title') }}</h1>
          <p class="text-mist-300">{{ t('upgrades.subtitle') }}</p>
        </div>
        <RouterLink
          v-if="data"
          :to="{ name: 'gems' }"
          class="font-display text-3xl font-bold text-gold-400 tabular-nums hover:underline"
          data-testid="upgrades-balance"
        >
          {{ t('nav.gems', { count: n(data.gemBalance, 'integer') }) }}
        </RouterLink>
      </header>

      <p v-if="upgrades.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <template v-else-if="data">
        <dl :class="[playerUi.panel, 'grid gap-4 sm:grid-cols-3']" data-testid="upgrades-summary">
          <div>
            <dt class="text-sm text-mist-300">{{ t('upgrades.summary.storage') }}</dt>
            <dd class="font-display text-2xl font-bold tabular-nums">
              {{ n(data.free.max, 'integer') }}
            </dd>
          </div>
          <div>
            <dt class="text-sm text-mist-300">{{ t('upgrades.summary.interval') }}</dt>
            <dd class="font-display text-2xl font-bold tabular-nums">
              {{ t('upgrades.summary.minutes', { count: minutes(data.free.intervalSeconds) }) }}
            </dd>
          </div>
          <div>
            <dt class="text-sm text-mist-300">{{ t('upgrades.summary.recycle') }}</dt>
            <dd class="font-display text-2xl font-bold tabular-nums">
              {{ t('upgrades.multiplier', { value: n(data.recycleMultiplier, 'decimal') }) }}
            </dd>
          </div>
        </dl>

        <ul class="grid gap-4 md:grid-cols-3">
          <li
            v-for="upgrade in data.upgrades"
            :key="upgrade.key"
            :class="[playerUi.panel, 'flex flex-col gap-4']"
            :data-testid="`upgrade-${upgrade.key}`"
          >
            <div class="flex flex-col gap-1">
              <h2 class="font-display text-xl font-bold">
                {{ t(`upgrades.names.${upgrade.key}`) }}
              </h2>
              <p class="text-sm text-mist-300">{{ t(`upgrades.help.${upgrade.key}`) }}</p>
            </div>

            <template v-if="upgrade.maxLevel > 0">
              <div class="flex flex-col gap-2">
                <p class="text-sm text-mist-300">
                  {{
                    t('upgrades.level', {
                      level: n(Math.min(upgrade.level, upgrade.maxLevel), 'integer'),
                      max: n(upgrade.maxLevel, 'integer'),
                    })
                  }}
                </p>
                <div class="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                  <span
                    v-for="index in upgrade.maxLevel"
                    :key="index"
                    class="flex-1"
                    :class="index <= upgrade.level ? 'bg-gold-400' : 'bg-night-700'"
                  />
                </div>
              </div>
              <dl class="flex flex-col gap-1 text-sm">
                <div class="flex justify-between gap-2">
                  <dt class="text-mist-300">{{ t('upgrades.current') }}</dt>
                  <dd data-testid="upgrade-current">
                    {{
                      upgrade.value === null
                        ? t('upgrades.none')
                        : effect(upgrade.key, upgrade.value)
                    }}
                  </dd>
                </div>
                <div v-if="upgrade.next" class="flex justify-between gap-2">
                  <dt class="text-mist-300">{{ t('upgrades.next') }}</dt>
                  <dd class="text-emerald-400">{{ effect(upgrade.key, upgrade.next.value) }}</dd>
                </div>
              </dl>
              <button
                v-if="upgrade.next"
                type="button"
                class="mt-auto rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700 disabled:opacity-50"
                :disabled="!canAfford(upgrade) || buy.isPending.value"
                :data-testid="`upgrade-buy-${upgrade.key}`"
                @click="buy.mutate({ key: upgrade.key, level: upgrade.next.level })"
              >
                {{ t('upgrades.buy', { gems: n(upgrade.next.cost, 'integer') }) }}
              </button>
              <p v-else class="mt-auto text-sm font-semibold text-gold-400">
                {{ t('upgrades.maxed') }}
              </p>
            </template>
            <p v-else class="mt-auto text-sm text-mist-300">{{ t('upgrades.unavailable') }}</p>
          </li>
        </ul>
      </template>
    </RequireSignIn>
  </main>
</template>
