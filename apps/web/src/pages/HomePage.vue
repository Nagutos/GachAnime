<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useSession } from '@/app/session'
import DiscordSignInButton from '@/components/DiscordSignInButton.vue'

const { t, n } = useI18n()
const { isPending, isSignedIn, me } = useSession()

const features = ['collect', 'trade', 'wiki'] as const
</script>

<template>
  <main class="mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-4 py-16 text-center">
    <section class="flex flex-col items-center gap-6">
      <h1 class="font-display text-5xl font-extrabold sm:text-6xl">
        <span class="bg-linear-to-r from-sakura-400 to-gold-400 bg-clip-text text-transparent">
          {{ t('app.name') }}
        </span>
      </h1>
      <p class="max-w-xl text-lg text-mist-300">{{ t('app.tagline') }}</p>

      <p v-if="isPending" class="text-mist-300">{{ t('common.loading') }}</p>
      <DiscordSignInButton v-else-if="!isSignedIn" />
      <div v-else-if="me" class="flex flex-col items-center gap-3" data-testid="welcome">
        <p class="text-xl font-semibold">{{ t('home.welcome', { name: me.displayName }) }}</p>
        <p class="rounded-full bg-night-800 px-4 py-1 text-gold-400">
          {{ t('home.gemBalance') }} · {{ n(me.gemBalance, 'integer') }}
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <RouterLink
            :to="{ name: 'boosters' }"
            class="rounded-xl bg-sakura-600 px-5 py-3 font-semibold text-white shadow-lg shadow-sakura-500/20 hover:bg-sakura-700"
            data-testid="cta-boosters"
          >
            {{ t('home.openBoosters') }}
          </RouterLink>
          <RouterLink
            :to="{ name: 'collection' }"
            class="rounded-xl border border-night-700 bg-night-800 px-5 py-3 font-semibold hover:bg-night-700"
          >
            {{ t('home.myCollection') }}
          </RouterLink>
        </div>
      </div>
    </section>

    <ul class="grid w-full gap-4 sm:grid-cols-3">
      <li
        v-for="feature in features"
        :key="feature"
        class="rounded-2xl border border-night-700 bg-night-900/70 p-6 text-left"
      >
        <h2 class="font-display text-xl font-bold text-sakura-400">
          {{ t(`home.features.${feature}.title`) }}
        </h2>
        <p class="mt-2 text-mist-300">{{ t(`home.features.${feature}.body`) }}</p>
      </li>
    </ul>
  </main>
</template>
