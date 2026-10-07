<script setup lang="ts">
import type { OpenBoostersResponse, OpenedCard } from '@gachanime/shared'
import { AnimatePresence, motion, useReducedMotion } from 'motion-v'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { usePlayerRarities } from '@/app/rarities'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import { HIGHLIGHT_RARITIES } from '@/components/cards/rarity-styles'
import BoosterPack from './BoosterPack.vue'
import FlipCard from './FlipCard.vue'

const props = defineProps<{ result: OpenBoostersResponse; packLabel: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { rankOf } = usePlayerRarities()
const reduced = useReducedMotion()

type Stage = 'pack' | 'cards' | 'summary'
const stage = ref<Stage>('pack')
const packIndex = ref(0)
const torn = ref(false)
const revealed = ref(new Set<number>())
const timers: ReturnType<typeof setTimeout>[] = []

const packs = computed(() => {
  const size = props.result.cardsPerBooster
  const groups: OpenedCard[][] = []
  for (let i = 0; i < props.result.cards.length; i += size) {
    groups.push(props.result.cards.slice(i, i + size))
  }
  return groups
})
const currentPack = computed(() => packs.value[packIndex.value] ?? [])
const isLastPack = computed(() => packIndex.value >= packs.value.length - 1)
const allRevealed = computed(() =>
  currentPack.value.every((card) => revealed.value.has(card.position)),
)

/** The pack glows with the color of its best card when it is epic or better. */
const packGlow = computed(() => {
  const best = [...currentPack.value].sort(
    (a, b) => rankOf(b.character.rarityKey) - rankOf(a.character.rarityKey),
  )[0]
  const key = best?.character.rarityKey
  return key && HIGHLIGHT_RARITIES.has(key) ? key : null
})

const summaryCards = computed(() =>
  [...props.result.cards].sort(
    (a, b) =>
      rankOf(b.character.rarityKey) - rankOf(a.character.rarityKey) || a.position - b.position,
  ),
)
const newCount = computed(() => props.result.cards.filter((card) => card.isNew).length)

function later(callback: () => void, ms: number): void {
  if (reduced.value) callback()
  else timers.push(setTimeout(callback, ms))
}

function openPack(): void {
  if (torn.value) return
  torn.value = true
  later(() => (stage.value = 'cards'), 550)
}

function reveal(position: number): void {
  revealed.value = new Set(revealed.value).add(position)
}

function revealAll(): void {
  currentPack.value
    .filter((card) => !revealed.value.has(card.position))
    .forEach((card, index) => later(() => reveal(card.position), index * 180))
}

function nextPack(): void {
  packIndex.value++
  torn.value = false
  stage.value = 'pack'
}

function showSummary(): void {
  timers.forEach(clearTimeout)
  stage.value = 'summary'
}

/** Escape skips to the summary first; a second Escape closes. */
function onEscape(event: KeyboardEvent): void {
  if (stage.value !== 'summary') {
    event.preventDefault()
    showSummary()
  }
}

onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <DialogRoot :open="true" @update:open="(open: boolean) => !open && emit('close')">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-night-950/90 backdrop-blur-sm" />
      <DialogContent
        class="fixed inset-0 z-50 flex flex-col overflow-y-auto px-4 py-6 outline-none"
        data-testid="booster-opening"
        @escape-key-down="onEscape"
        @pointer-down-outside.prevent
      >
        <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div>
            <DialogTitle class="font-display text-2xl font-bold">{{ packLabel }}</DialogTitle>
            <DialogDescription class="text-sm text-mist-300">
              <template v-if="stage === 'summary'">
                {{ t('boosters.summary', { cards: result.cards.length, new: newCount }) }}
              </template>
              <template v-else>
                {{ t('boosters.packProgress', { current: packIndex + 1, total: packs.length }) }}
              </template>
            </DialogDescription>
          </div>
          <button
            v-if="stage !== 'summary'"
            type="button"
            class="rounded-lg border border-night-700 px-3 py-2 text-sm text-mist-300 hover:bg-night-800"
            data-testid="skip"
            @click="showSummary"
          >
            {{ t('boosters.skip') }}
          </button>
        </div>

        <div class="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              v-if="stage === 'pack'"
              :key="`pack-${packIndex}`"
              class="flex flex-col items-center gap-6"
              :initial="{ opacity: 0, scale: 0.85 }"
              :animate="{ opacity: 1, scale: 1 }"
              :exit="{ opacity: 0 }"
              :transition="{ duration: reduced ? 0 : 0.3 }"
            >
              <button
                type="button"
                class="w-52 sm:w-60"
                :aria-label="t('boosters.tapToOpen')"
                data-testid="pack"
                @click="openPack"
              >
                <BoosterPack
                  :label="packLabel"
                  :cards="result.cardsPerBooster"
                  :torn="torn"
                  :glow-rarity="packGlow"
                  :idle="!torn"
                />
              </button>
              <p class="text-mist-300" :class="{ invisible: torn }">
                {{ t('boosters.tapToOpen') }}
              </p>
            </motion.div>

            <motion.div
              v-else-if="stage === 'cards'"
              :key="`cards-${packIndex}`"
              class="flex w-full flex-col items-center gap-8"
              :initial="{ opacity: 0 }"
              :animate="{ opacity: 1 }"
              :exit="{ opacity: 0 }"
              :transition="{ duration: reduced ? 0 : 0.25 }"
            >
              <ul class="flex w-full max-w-5xl flex-wrap justify-center gap-3 sm:gap-4">
                <motion.li
                  v-for="(card, index) in currentPack"
                  :key="card.position"
                  class="w-[29%] max-w-44 sm:w-[18%]"
                  :initial="{ opacity: 0, y: 60, rotate: -6 }"
                  :animate="{ opacity: 1, y: 0, rotate: 0 }"
                  :transition="{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : index * 0.08 }"
                >
                  <FlipCard
                    :card="card"
                    :revealed="revealed.has(card.position)"
                    @reveal="reveal(card.position)"
                  />
                </motion.li>
              </ul>
              <div class="flex flex-wrap justify-center gap-3">
                <button
                  v-if="!allRevealed"
                  type="button"
                  class="rounded-xl bg-night-800 px-5 py-3 font-semibold hover:bg-night-700"
                  data-testid="reveal-all"
                  @click="revealAll"
                >
                  {{ t('boosters.revealAll') }}
                </button>
                <template v-else>
                  <button
                    v-if="!isLastPack"
                    type="button"
                    class="rounded-xl bg-sakura-500 px-5 py-3 font-semibold text-white hover:bg-sakura-600"
                    data-testid="next-pack"
                    @click="nextPack"
                  >
                    {{ t('boosters.nextPack') }}
                  </button>
                  <button
                    v-else-if="packs.length > 1"
                    type="button"
                    class="rounded-xl bg-sakura-500 px-5 py-3 font-semibold text-white hover:bg-sakura-600"
                    data-testid="show-summary"
                    @click="showSummary"
                  >
                    {{ t('boosters.showSummary') }}
                  </button>
                  <button
                    v-else
                    type="button"
                    class="rounded-xl bg-sakura-500 px-5 py-3 font-semibold text-white hover:bg-sakura-600"
                    data-testid="close-opening"
                    @click="emit('close')"
                  >
                    {{ t('boosters.done') }}
                  </button>
                </template>
              </div>
            </motion.div>

            <motion.div
              v-else
              key="summary"
              class="flex w-full max-w-5xl flex-col items-center gap-6"
              :initial="{ opacity: 0, y: 20 }"
              :animate="{ opacity: 1, y: 0 }"
              :transition="{ duration: reduced ? 0 : 0.3 }"
            >
              <ul
                class="grid w-full grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8"
                data-testid="opening-summary"
              >
                <li v-for="card in summaryCards" :key="card.position">
                  <RouterLink
                    :to="{ name: 'wiki-character', params: { id: card.character.id } }"
                    @click="emit('close')"
                  >
                    <CharacterCard
                      :name="card.character.name"
                      :image-url="card.character.imageUrl"
                      :rarity-key="card.character.rarityKey"
                      :series-title="card.character.series?.title"
                      :is-new="card.isNew"
                      :effects="false"
                    />
                  </RouterLink>
                </li>
              </ul>
              <button
                type="button"
                class="rounded-xl bg-sakura-500 px-6 py-3 font-semibold text-white hover:bg-sakura-600"
                data-testid="close-opening"
                @click="emit('close')"
              >
                {{ t('boosters.done') }}
              </button>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
