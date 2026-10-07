<script setup lang="ts">
import { resolveLocalizedText } from '@gachanime/shared'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAchievementsQuery, useClaimAchievementMutation } from '@/api/progression'
import { useErrorMessage } from '@/app/errors'
import ObjectiveProgress from '@/components/ObjectiveProgress.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const STATUSES = ['all', 'todo', 'completed'] as const

const { t, n, d, locale } = useI18n()
const status = ref<(typeof STATUSES)[number]>('all')
const query = useAchievementsQuery(status)
const claim = useClaimAchievementMutation()
const errorMessage = useErrorMessage(claim.error)
const data = computed(() => query.data.value)
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('achievements.title') }}</h1>
          <p class="text-mist-300">{{ t('achievements.subtitle') }}</p>
        </div>
        <p
          v-if="data"
          class="font-display text-3xl font-bold tabular-nums"
          data-testid="achievements-counter"
        >
          {{ t('achievements.counter', { completed: data.completed, total: data.total }) }}
        </p>
      </header>

      <div class="flex rounded-lg border border-night-700 p-0.5 self-start" role="group">
        <button
          v-for="value in STATUSES"
          :key="value"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm"
          :class="
            status === value
              ? 'bg-night-700 font-semibold text-mist-100'
              : 'text-mist-300 hover:text-mist-100'
          "
          :aria-pressed="status === value"
          @click="status = value"
        >
          {{ t(`achievements.filters.${value}`) }}
        </button>
      </div>
      <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
      <p v-if="query.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="data && data.items.length === 0" :class="playerUi.panel">
        {{ t('achievements.empty') }}
      </p>

      <ul v-else-if="data" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="achievement in data.items"
          :key="achievement.id"
          :class="[
            playerUi.panel,
            'flex flex-col gap-3 p-4',
            achievement.completedAt ? 'border-gold-400/50' : '',
          ]"
          :data-testid="`achievement-${achievement.key}`"
        >
          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full"
              :class="
                achievement.completedAt
                  ? 'bg-gold-400/20 text-gold-400'
                  : 'bg-night-800 text-mist-300'
              "
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" class="size-5 fill-current">
                <path
                  d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z"
                />
              </svg>
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ resolveLocalizedText(achievement.name, locale) }}</p>
              <p v-if="achievement.description" class="text-sm text-mist-300">
                {{ resolveLocalizedText(achievement.description, locale) }}
              </p>
            </div>
            <span class="text-sm font-semibold whitespace-nowrap text-gold-400 tabular-nums">
              {{ t('missions.reward', { gems: n(achievement.rewardGems, 'integer') }) }}
            </span>
          </div>
          <ObjectiveProgress
            :progress="achievement.progress"
            :target="achievement.target"
            :done="Boolean(achievement.completedAt)"
            :percent="achievement.metric === 'catalog_completion'"
          />
          <div class="flex items-center justify-between gap-2">
            <span v-if="achievement.completedAt" class="text-xs text-mist-300">
              {{
                t('achievements.completedOn', {
                  date: d(new Date(achievement.completedAt), 'short'),
                })
              }}
            </span>
            <span v-else />
            <button
              v-if="achievement.completedAt && !achievement.claimedAt"
              type="button"
              class="rounded-xl bg-gold-400 px-4 py-1.5 font-semibold text-night-950 hover:brightness-110 disabled:opacity-50"
              :disabled="claim.isPending.value"
              data-testid="claim-achievement"
              @click="claim.mutate(achievement.id)"
            >
              {{ t('progression.claim') }}
            </button>
            <span v-else-if="achievement.claimedAt" class="text-sm text-emerald-400">
              {{ t('progression.claimed') }}
            </span>
          </div>
        </li>
      </ul>
    </RequireSignIn>
  </main>
</template>
