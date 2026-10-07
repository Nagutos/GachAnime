<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { useRecycleCardsMutation, useWikiCharacterQuery } from '@/api/player'
import { useErrorMessage } from '@/app/errors'
import { usePlayerRarities } from '@/app/rarities'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import LockedCard from '@/components/cards/LockedCard.vue'
import { rarityStyle } from '@/components/cards/rarity-styles'
import WishlistButton from '@/components/collection/WishlistButton.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'
import DescriptionText from '@/components/wiki/DescriptionText.vue'

const props = defineProps<{ id: number }>()
const { t, d, n } = useI18n()
const router = useRouter()
const { nameOf } = usePlayerRarities()

const query = useWikiCharacterQuery(() => props.id)
const entry = computed(() => query.data.value)
const errorMessage = useErrorMessage(query.error)

const recycle = useRecycleCardsMutation()
const recycleError = useErrorMessage(recycle.error)
const recycleCount = ref(1)
const recycled = ref<{ cards: number; gems: number } | null>(null)
watch(
  () => props.id,
  () => {
    recycleCount.value = 1
    recycled.value = null
    recycle.reset()
  },
)

async function recycleCopies(): Promise<void> {
  const current = entry.value
  if (!current || current.locked) return
  const count = Math.min(Math.max(1, Math.floor(recycleCount.value)), current.recyclable)
  const result = await recycle.mutateAsync({ characterId: current.id, count }).catch(() => null)
  if (result) {
    recycled.value = { cards: result.cards, gems: result.gems }
    recycleCount.value = 1
  }
}

function back(): void {
  if (window.history.state?.back) router.back()
  else void router.push({ name: 'wiki' })
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <button
        type="button"
        class="self-start text-sm text-mist-300 hover:text-sakura-400"
        @click="back"
      >
        {{ t('wiki.backShort') }}
      </button>

      <p v-if="query.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>

      <article v-else-if="entry" class="flex flex-col gap-8 md:flex-row" data-testid="wiki-entry">
        <div class="mx-auto w-56 shrink-0 md:mx-0 md:w-72">
          <LockedCard v-if="entry.locked" :rarity-key="entry.rarityKey" />
          <CharacterCard
            v-else
            :name="entry.name"
            :image-url="entry.imageUrl"
            :rarity-key="entry.rarityKey"
            :quantity="entry.quantity"
          />
          <WishlistButton
            class="mt-3 w-full"
            :character-id="entry.id"
            :wishlisted="entry.wishlisted"
            large
          />
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-5">
          <template v-if="entry.locked">
            <div>
              <h1 :class="playerUi.title">{{ t('wiki.unknownName') }}</h1>
              <p class="font-semibold" :class="rarityStyle(entry.rarityKey).text">
                {{ nameOf(entry.rarityKey) }}
              </p>
            </div>
            <div :class="playerUi.panel">
              <p class="font-semibold">{{ t('wiki.lockedTitle') }}</p>
              <p class="text-mist-300">{{ t('wiki.lockedBody') }}</p>
            </div>
          </template>

          <template v-else>
            <div>
              <h1 :class="playerUi.title" data-testid="wiki-name">{{ entry.name }}</h1>
              <p v-if="entry.nameNative" class="text-lg text-mist-300">{{ entry.nameNative }}</p>
              <p class="mt-1 font-semibold" :class="rarityStyle(entry.rarityKey).text">
                {{ nameOf(entry.rarityKey) }}
              </p>
            </div>

            <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <template v-if="entry.nameAlternatives.length">
                <dt class="text-mist-300">{{ t('wiki.alternativeNames') }}</dt>
                <dd>{{ entry.nameAlternatives.join(', ') }}</dd>
              </template>
              <dt class="text-mist-300">{{ t('wiki.collection') }}</dt>
              <dd>
                <template v-if="entry.quantity > 0">
                  {{ t('wiki.owned', { count: entry.quantity }, entry.quantity) }}
                </template>
                <template v-else>{{ t('wiki.notOwned') }}</template>
                ·
                {{ t('wiki.firstObtained', { date: d(new Date(entry.firstObtainedAt), 'short') }) }}
              </dd>
            </dl>

            <section
              v-if="entry.recyclable > 0 || recycled"
              :class="[playerUi.panel, 'flex flex-col gap-3']"
              data-testid="recycle-section"
            >
              <h2 class="font-display text-lg font-bold">{{ t('recycle.single') }}</h2>
              <p v-if="entry.recyclable > 0" class="text-sm text-mist-300">
                {{
                  t('recycle.singleHelp', {
                    count: n(entry.recyclable, 'integer'),
                    gems: n(entry.recycleValue, 'integer'),
                  })
                }}
              </p>
              <div v-if="entry.recyclable > 0" class="flex flex-wrap items-center gap-3">
                <input
                  v-model.number="recycleCount"
                  type="number"
                  min="1"
                  :max="entry.recyclable"
                  :class="[playerUi.input, 'w-24']"
                  :aria-label="t('recycle.count')"
                />
                <button
                  type="button"
                  class="rounded-xl bg-sakura-500 px-4 py-2 font-semibold text-white hover:bg-sakura-600 disabled:opacity-50"
                  :disabled="recycle.isPending.value"
                  data-testid="recycle-single"
                  @click="recycleCopies"
                >
                  {{
                    t('recycle.singleConfirm', {
                      gems: n(
                        Math.min(Math.max(1, recycleCount || 1), entry.recyclable) *
                          entry.recycleValue,
                        'integer',
                      ),
                    })
                  }}
                </button>
              </div>
              <p v-if="recycled" class="text-sm text-emerald-400" role="status">
                {{
                  t(
                    'recycle.done',
                    {
                      cards: n(recycled.cards, 'integer'),
                      gems: n(recycled.gems, 'integer'),
                    },
                    recycled.cards,
                  )
                }}
              </p>
              <p v-if="recycleError" :class="playerUi.error" role="alert">{{ recycleError }}</p>
            </section>

            <section class="flex flex-col gap-2">
              <h2 class="font-display text-lg font-bold">{{ t('wiki.about') }}</h2>
              <DescriptionText :text="entry.description" />
            </section>

            <section v-if="entry.appearances.length" class="flex flex-col gap-2">
              <h2 class="font-display text-lg font-bold">{{ t('wiki.appearances') }}</h2>
              <ul class="flex flex-col gap-1 text-sm">
                <li
                  v-for="(appearance, index) in entry.appearances"
                  :key="index"
                  class="flex flex-wrap items-baseline gap-x-2"
                >
                  <span>{{ appearance.title }}</span>
                  <span class="text-xs text-mist-300">
                    {{ [appearance.format, appearance.seasonYear].filter(Boolean).join(' · ') }}
                  </span>
                  <span class="rounded bg-night-800 px-1.5 text-[11px] text-mist-300">
                    {{ t(`wiki.roles.${appearance.role}`) }}
                  </span>
                </li>
              </ul>
            </section>

            <p v-if="entry.anilistUrl" class="text-xs text-mist-300">
              {{ t('wiki.source') }}
              <a
                :href="entry.anilistUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="underline hover:text-sakura-400"
              >
                {{ t('wiki.sourceAniList') }}
              </a>
            </p>
          </template>

          <section v-if="entry.series.length" class="flex flex-col gap-2">
            <h2 class="font-display text-lg font-bold">{{ t('wiki.series') }}</h2>
            <ul class="flex flex-wrap gap-2">
              <li v-for="item in entry.series" :key="item.id">
                <RouterLink
                  :to="{ name: 'wiki-series', params: { id: item.id } }"
                  class="inline-block rounded-full border border-night-700 px-3 py-1 text-sm hover:border-sakura-400 hover:text-sakura-400"
                >
                  {{ item.title }}
                </RouterLink>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </RequireSignIn>
  </main>
</template>
