<script setup lang="ts">
import { resolveLocalizedText } from '@gachanime/shared'
import { AnimatePresence, motion, useReducedMotion } from 'motion-v'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { dismissToast, toasts } from '@/app/toasts'

const { t, n, locale } = useI18n()
const reduced = useReducedMotion()
</script>

<template>
  <div
    class="pointer-events-none fixed right-4 bottom-4 z-60 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    role="status"
    aria-live="polite"
  >
    <AnimatePresence>
      <motion.div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-2xl border border-gold-400/50 bg-night-900/95 p-3 shadow-2xl backdrop-blur"
        :initial="reduced ? { opacity: 0 } : { opacity: 0, x: 60 }"
        :animate="{ opacity: 1, x: 0 }"
        :exit="reduced ? { opacity: 0 } : { opacity: 0, x: 60 }"
        :transition="{ duration: reduced ? 0 : 0.25 }"
        data-testid="toast"
      >
        <span
          class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-gold-400"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" class="size-5 fill-current">
            <path
              d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z"
            />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold tracking-wide text-gold-400 uppercase">
            {{
              toast.objective.kind === 'mission'
                ? t('progression.missionCompleted')
                : t('progression.achievementCompleted')
            }}
          </p>
          <p class="truncate font-semibold">
            {{ resolveLocalizedText(toast.objective.name, locale) }}
          </p>
          <RouterLink
            :to="{ name: toast.objective.kind === 'mission' ? 'missions' : 'achievements' }"
            class="text-sm text-mist-300 underline hover:text-mist-100"
            @click="dismissToast(toast.id)"
          >
            {{ t('progression.claimReward', { gems: n(toast.objective.rewardGems, 'integer') }) }}
          </RouterLink>
        </div>
        <button
          type="button"
          class="text-mist-300 hover:text-mist-100"
          :aria-label="t('common.close')"
          @click="dismissToast(toast.id)"
        >
          ✕
        </button>
      </motion.div>
    </AnimatePresence>
  </div>
</template>
