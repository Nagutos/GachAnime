<script setup lang="ts">
import { resolveLocalizedText, type MissionDto } from '@gachanime/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useClaimMissionMutation, useMissionsQuery } from '@/api/progression'
import { useErrorMessage } from '@/app/errors'
import { formatCountdown, useServerNow } from '@/app/now'
import ObjectiveProgress from '@/components/ObjectiveProgress.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const { t, n, locale } = useI18n()
const missions = useMissionsQuery()
const claim = useClaimMissionMutation()
const errorMessage = useErrorMessage(claim.error)
const data = computed(() => missions.data.value)

const offset = ref(0)
watch(data, (value) => {
  if (value) offset.value = Date.parse(value.serverTime) - Date.now()
})
const now = useServerNow(offset)
const resetMs = computed(() => (data.value ? Date.parse(data.value.nextResetAt) : null))
watch(now, (value) => {
  if (resetMs.value !== null && value >= resetMs.value && !missions.isFetching.value) {
    void missions.refetch()
  }
})

const sections = computed(() =>
  data.value
    ? (
        [
          ['daily', data.value.daily],
          ['once', data.value.once],
        ] as const
      ).filter(([, items]) => items.length > 0)
    : [],
)

function claimMission(mission: MissionDto): void {
  claim.mutate({ missionId: mission.id, periodKey: mission.periodKey })
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('missions.title') }}</h1>
          <p class="text-mist-300">{{ t('missions.subtitle') }}</p>
        </div>
        <RouterLink :to="{ name: 'achievements' }" class="text-gold-400 underline">
          {{ t('missions.toAchievements') }}
        </RouterLink>
      </header>
      <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
      <p v-if="missions.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>

      <section v-for="[kind, items] in sections" :key="kind" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-display text-xl font-bold">{{ t(`missions.kinds.${kind}`) }}</h2>
          <p v-if="kind === 'daily' && resetMs" class="text-sm text-mist-300">
            {{ t('missions.resetsIn', { time: formatCountdown(resetMs, now) }) }}
          </p>
        </div>
        <ul class="flex flex-col gap-3">
          <li
            v-for="mission in items"
            :key="mission.id"
            :class="[playerUi.panel, 'flex flex-wrap items-center gap-4 p-4']"
            :data-testid="`mission-${mission.key}`"
          >
            <div class="min-w-48 flex-1">
              <p class="font-semibold">{{ resolveLocalizedText(mission.name, locale) }}</p>
              <p v-if="mission.description" class="text-sm text-mist-300">
                {{ resolveLocalizedText(mission.description, locale) }}
              </p>
              <ObjectiveProgress
                class="mt-2 max-w-sm"
                :progress="mission.progress"
                :target="mission.target"
                :done="mission.completed"
              />
            </div>
            <span class="font-semibold text-gold-400 tabular-nums">
              {{ t('missions.reward', { gems: n(mission.rewardGems, 'integer') }) }}
            </span>
            <button
              v-if="mission.completed && !mission.claimed"
              type="button"
              class="rounded-xl bg-gold-400 px-4 py-2 font-semibold text-night-950 hover:brightness-110 disabled:opacity-50"
              :disabled="claim.isPending.value"
              data-testid="claim-mission"
              @click="claimMission(mission)"
            >
              {{ t('progression.claim') }}
            </button>
            <span v-else-if="mission.claimed" class="text-sm text-emerald-400">
              {{ t('progression.claimed') }}
            </span>
          </li>
        </ul>
      </section>
    </RequireSignIn>
  </main>
</template>
