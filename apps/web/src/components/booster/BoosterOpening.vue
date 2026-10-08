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
import { flushDeferredToasts } from '@/app/toasts'
import CardBack from '@/components/cards/CardBack.vue'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import { HIGHLIGHT_RARITIES } from '@/components/cards/rarity-styles'
import BoosterPack from './BoosterPack.vue'
import FlipCard from './FlipCard.vue'
import { PACK_TEAR_MS } from './pack-shape'
import TiltCard from './TiltCard.vue'

const props = withDefaults(
  defineProps<{
    result: OpenBoostersResponse
    packLabel: string
    packArt?: string
    packRibbon?: string | null
  }>(),
  { packArt: 'free', packRibbon: null },
)
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { rankOf } = usePlayerRarities()
const reduced = useReducedMotion()

type Stage = 'pack' | 'cards' | 'summary'
const stage = ref<Stage>('pack')
/** Cards of a pack: inspected one by one, then all laid out in a grid. */
const cardMode = ref<'single' | 'grid'>('single')
const focusIndex = ref(0)
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
const focusedCard = computed(() => currentPack.value[focusIndex.value] ?? null)
/** Face-down cards drawn behind the inspected one (at most three). */
const stackDepth = computed(() =>
  Math.min(3, Math.max(0, currentPack.value.length - focusIndex.value - 1)),
)
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
  later(() => {
    cardMode.value = 'single'
    focusIndex.value = 0
    stage.value = 'cards'
  }, PACK_TEAR_MS + 150)
}

function reveal(position: number): void {
  revealed.value = new Set(revealed.value).add(position)
}

/** One-by-one reveal: the next card comes forward; after the last one, every card is laid out. */
let advancing = false
function nextCard(): void {
  // The previous card is still flying away: a second click must not skip a card.
  if (advancing) return
  advancing = true
  later(() => (advancing = false), 320)
  if (focusIndex.value < currentPack.value.length - 1) focusIndex.value++
  else cardMode.value = 'grid'
}

/** Lays out the whole pack, then flips the cards still face down while they land. */
function revealAll(): void {
  const wasSingle = cardMode.value === 'single'
  cardMode.value = 'grid'
  currentPack.value
    .filter((card) => !revealed.value.has(card.position))
    .forEach((card, index) =>
      later(() => reveal(card.position), (wasSingle ? 450 : 0) + index * 160),
    )
}

function nextPack(): void {
  packIndex.value++
  torn.value = false
  cardMode.value = 'single'
  focusIndex.value = 0
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

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  flushDeferredToasts()
})
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
        <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
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
                  :art="packArt"
                  :ribbon="packRibbon"
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
              v-else-if="stage === 'cards' && cardMode === 'single' && focusedCard"
              :key="`single-${packIndex}`"
              class="flex w-full flex-col items-center gap-5"
              :initial="{ opacity: 0, y: 40 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0 }"
              :transition="{ duration: reduced ? 0 : 0.3 }"
            >
              <p class="text-sm text-mist-300 tabular-nums" data-testid="card-progress">
                {{
                  t('boosters.cardProgress', {
                    current: focusIndex + 1,
                    total: currentPack.length,
                  })
                }}
              </p>
              <div class="relative w-56 sm:w-64">
                <!-- The cards still to come, face down behind the inspected one -->
                <div
                  v-for="depth in stackDepth"
                  :key="depth"
                  class="absolute inset-0"
                  :style="{
                    transform: `translate(${depth * 7}px, ${depth * 5}px) rotate(${depth * 2.5}deg)`,
                    zIndex: -depth,
                    opacity: 1 - depth * 0.2,
                  }"
                  aria-hidden="true"
                >
                  <CardBack />
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    :key="focusedCard.position"
                    :initial="{ opacity: 0, y: 18, scale: 0.94 }"
                    :animate="{ opacity: 1, y: 0, scale: 1, x: 0, rotate: 0 }"
                    :exit="{ opacity: 0, x: 240, y: 40, rotate: 16, scale: 0.75 }"
                    :transition="{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }"
                  >
                    <TiltCard sway>
                      <FlipCard
                        :card="focusedCard"
                        :revealed="revealed.has(focusedCard.position)"
                        advance
                        @reveal="reveal(focusedCard.position)"
                        @next="nextCard"
                      />
                    </TiltCard>
                  </motion.div>
                </AnimatePresence>
              </div>
              <p class="mt-3 h-5 text-sm text-mist-300">
                {{
                  revealed.has(focusedCard.position)
                    ? t('boosters.tiltHint')
                    : t('boosters.tapToReveal')
                }}
              </p>
              <div class="flex flex-wrap justify-center gap-3">
                <button
                  v-if="revealed.has(focusedCard.position)"
                  type="button"
                  class="rounded-xl bg-sakura-600 px-5 py-3 font-semibold text-white hover:bg-sakura-700"
                  data-testid="next-card"
                  @click="nextCard"
                >
                  {{ t('boosters.nextCard') }}
                </button>
                <button
                  type="button"
                  class="rounded-xl bg-night-800 px-5 py-3 font-semibold hover:bg-night-700"
                  data-testid="reveal-all"
                  @click="revealAll"
                >
                  {{ t('boosters.revealAll') }}
                </button>
              </div>
            </motion.div>

            <motion.div
              v-else-if="stage === 'cards'"
              :key="`grid-${packIndex}`"
              class="flex w-full flex-col items-center gap-8"
              :initial="{ opacity: 0 }"
              :animate="{ opacity: 1 }"
              :exit="{ opacity: 0 }"
              :transition="{ duration: reduced ? 0 : 0.2 }"
            >
              <ul class="flex w-full max-w-6xl flex-wrap justify-center gap-3 sm:gap-4">
                <!-- Dealt from the stack: each card flies from the center to its place -->
                <motion.li
                  v-for="(card, index) in currentPack"
                  :key="card.position"
                  class="w-[29%] max-w-48 sm:w-[18%]"
                  :initial="{
                    opacity: 0,
                    y: -160,
                    scale: 0.55,
                    rotate: (index - (currentPack.length - 1) / 2) * 9,
                  }"
                  :animate="{ opacity: 1, y: 0, scale: 1, rotate: 0 }"
                  :transition="{
                    duration: reduced ? 0 : 0.5,
                    delay: reduced ? 0 : index * 0.08,
                    ease: 'easeOut',
                  }"
                >
                  <TiltCard :max="10">
                    <FlipCard
                      :card="card"
                      :revealed="revealed.has(card.position)"
                      @reveal="reveal(card.position)"
                    />
                  </TiltCard>
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
                    class="rounded-xl bg-sakura-600 px-5 py-3 font-semibold text-white hover:bg-sakura-700"
                    data-testid="next-pack"
                    @click="nextPack"
                  >
                    {{ t('boosters.nextPack') }}
                  </button>
                  <button
                    v-else-if="packs.length > 1"
                    type="button"
                    class="rounded-xl bg-sakura-600 px-5 py-3 font-semibold text-white hover:bg-sakura-700"
                    data-testid="show-summary"
                    @click="showSummary"
                  >
                    {{ t('boosters.showSummary') }}
                  </button>
                  <button
                    v-else
                    type="button"
                    class="rounded-xl bg-sakura-600 px-5 py-3 font-semibold text-white hover:bg-sakura-700"
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
              class="flex w-full max-w-6xl flex-col items-center gap-6"
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
                class="rounded-xl bg-sakura-600 px-6 py-3 font-semibold text-white hover:bg-sakura-700"
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
