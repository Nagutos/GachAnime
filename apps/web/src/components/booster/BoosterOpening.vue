<script setup lang="ts">
import type { OpenBoostersResponse } from '@gachanime/shared'
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
import { usePlayerRarities } from '@/app/rarities'
import { flushDeferredToasts } from '@/app/toasts'
import CardBack from '@/components/cards/CardBack.vue'
import { HIGHLIGHT_RARITIES, rarityStyle } from '@/components/cards/rarity-styles'
import BoosterPack from './BoosterPack.vue'
import FlipCard from './FlipCard.vue'
import OpeningBackdrop from './OpeningBackdrop.vue'
import { PACK_TEAR_MS } from './pack-shape'
import TiltCard from './TiltCard.vue'

const props = withDefaults(
  defineProps<{
    result: OpenBoostersResponse
    packLabel: string
    packArt?: string
    packSeal?: string
  }>(),
  { packArt: 'free', packSeal: '招' },
)
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { rankOf } = usePlayerRarities()
const reduced = useReducedMotion()

/**
 * One pack whatever the quantity (×5 and ×10 open all their cards at once), torn open, then the
 * cards one by one from the most common to the rarest, then all of them in a grid.
 */
type Stage = 'pack' | 'single' | 'grid'
const stage = ref<Stage>('pack')
const focusIndex = ref(0)
const torn = ref(false)
const revealed = ref(new Set<number>())
const timers: ReturnType<typeof setTimeout>[] = []

const cards = computed(() =>
  [...props.result.cards].sort(
    (a, b) =>
      rankOf(a.character.rarityKey) - rankOf(b.character.rarityKey) || a.position - b.position,
  ),
)
const focusedCard = computed(() => cards.value[focusIndex.value] ?? null)
/** Face-down cards drawn behind the inspected one (at most three). */
const stackDepth = computed(() =>
  Math.min(3, Math.max(0, cards.value.length - focusIndex.value - 1)),
)
const allRevealed = computed(() => cards.value.every((card) => revealed.value.has(card.position)))
const newCount = computed(() => props.result.cards.filter((card) => card.isNew).length)
/** Many cards: a compact grid. */
const compact = computed(() => cards.value.length > 5)

/** The pack glows with the color of its best card when it is epic or better. */
const packGlow = computed(() => {
  const key = cards.value.at(-1)?.character.rarityKey
  return key && HIGHLIGHT_RARITIES.has(key) ? key : null
})

/** Halo behind the inspected card: its rarity once revealed. */
const haloClass = computed(() => {
  const card = focusedCard.value
  return card && revealed.value.has(card.position)
    ? rarityStyle(card.character.rarityKey).bg
    : 'bg-sakura-500'
})

function later(callback: () => void, ms: number): void {
  if (reduced.value) callback()
  else timers.push(setTimeout(callback, ms))
}

function openPack(): void {
  if (torn.value) return
  torn.value = true
  later(() => {
    focusIndex.value = 0
    stage.value = 'single'
  }, PACK_TEAR_MS + 150)
}

function reveal(position: number): void {
  revealed.value = new Set(revealed.value).add(position)
}

/** Clicks on the card flying away (still under the pointer) must do nothing. */
function isFocused(position: number): boolean {
  return focusedCard.value?.position === position
}

function revealFocused(position: number): void {
  if (isFocused(position)) reveal(position)
}

function nextFrom(position: number): void {
  if (isFocused(position)) nextCard()
}

/** The next card comes forward; after the last one, every card is laid out. */
let advancing = false
function nextCard(): void {
  // The previous card is still flying away: a second click must not skip a card.
  if (advancing) return
  advancing = true
  later(() => (advancing = false), 320)
  if (focusIndex.value < cards.value.length - 1) focusIndex.value++
  else stage.value = 'grid'
}

/** Lays out every card, then flips the ones still face down while they land. */
function revealAll(): void {
  const fromSingle = stage.value === 'single'
  stage.value = 'grid'
  const hidden = cards.value.filter((card) => !revealed.value.has(card.position))
  const step = Math.min(160, 2400 / Math.max(1, hidden.length))
  hidden.forEach((card, index) =>
    later(() => reveal(card.position), (fromSingle ? 450 : 0) + index * step),
  )
}

/** Skip: everything revealed at once. */
function skip(): void {
  timers.forEach(clearTimeout)
  torn.value = true
  revealed.value = new Set(cards.value.map((card) => card.position))
  stage.value = 'grid'
}

/** Escape skips to the grid first; a second Escape closes. */
function onEscape(event: KeyboardEvent): void {
  if (stage.value !== 'grid' || !allRevealed.value) {
    event.preventDefault()
    skip()
  }
}

/** Dealing delay of a grid card: the whole deal lasts at most ~1.2 s. */
function dealDelay(index: number): number {
  return reduced.value ? 0 : index * Math.min(0.08, 1.2 / cards.value.length)
}

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  flushDeferredToasts()
})
</script>

<template>
  <DialogRoot :open="true" @update:open="(open: boolean) => !open && emit('close')">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-night-950/80 backdrop-blur-xl" />
      <DialogContent
        class="fixed inset-0 z-50 flex flex-col overflow-y-auto px-4 py-6 outline-none"
        data-testid="booster-opening"
        @escape-key-down="onEscape"
        @pointer-down-outside.prevent
      >
        <OpeningBackdrop />
        <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div>
            <DialogTitle class="font-display text-2xl font-bold">{{ packLabel }}</DialogTitle>
            <DialogDescription class="text-sm text-mist-300">
              <template v-if="stage === 'grid'">
                {{ t('boosters.summary', { cards: result.cards.length, new: newCount }) }}
              </template>
              <template v-else>
                {{ t('boosters.cardsPerPack', { count: result.cards.length }) }}
              </template>
            </DialogDescription>
          </div>
          <button
            v-if="stage !== 'grid'"
            type="button"
            class="rounded-lg border border-night-700 bg-night-900/60 px-3 py-2 text-sm text-mist-300 hover:bg-night-800"
            data-testid="skip"
            @click="skip"
          >
            {{ t('boosters.skip') }}
          </button>
        </div>

        <div class="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              v-if="stage === 'pack'"
              key="pack"
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
                  :seal="packSeal"
                  :cards="result.cards.length"
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
              v-else-if="stage === 'single' && focusedCard"
              key="single"
              class="flex w-full flex-col items-center gap-5"
              :initial="{ opacity: 0, y: 40 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0 }"
              :transition="{ duration: reduced ? 0 : 0.3 }"
            >
              <p class="text-sm text-mist-300 tabular-nums" data-testid="card-progress">
                {{ t('boosters.cardProgress', { current: focusIndex + 1, total: cards.length }) }}
              </p>
              <div class="relative aspect-5/7 w-56 sm:w-64">
                <!-- Soft colored halo around the card -->
                <div
                  class="pointer-events-none absolute -inset-12 -z-10 rounded-full opacity-35 blur-3xl transition-colors duration-700"
                  :class="haloClass"
                  aria-hidden="true"
                />
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
                <!--
                  The top card flies away while the next one comes forward from the stack (no
                  wait between them). v-for over one card: the leaving card keeps handlers bound
                  to itself, and ignores clicks (see isFocused).
                -->
                <AnimatePresence>
                  <motion.div
                    v-for="card in [focusedCard]"
                    :key="card.position"
                    class="absolute inset-0"
                    :initial="{ x: 7, y: 5, rotate: 2.5, scale: 0.98 }"
                    :animate="{ opacity: 1, y: 0, scale: 1, x: 0, rotate: 0 }"
                    :exit="{
                      opacity: 0,
                      x: 260,
                      y: 40,
                      rotate: 16,
                      scale: 0.8,
                      zIndex: 10,
                      pointerEvents: 'none',
                    }"
                    :transition="{ duration: reduced ? 0 : 0.32, ease: 'easeOut' }"
                  >
                    <TiltCard sway>
                      <FlipCard
                        :card="card"
                        :revealed="revealed.has(card.position)"
                        advance
                        @reveal="revealFocused(card.position)"
                        @next="nextFrom(card.position)"
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
              <!-- One slot per card: filled as the cards are revealed -->
              <ol
                class="flex max-w-xl flex-wrap justify-center gap-1.5"
                :aria-label="t('boosters.slots', { revealed: revealed.size, total: cards.length })"
                data-testid="card-slots"
              >
                <li
                  v-for="(card, index) in cards"
                  :key="card.position"
                  class="relative h-9 w-6.5 overflow-hidden rounded-md border transition-colors duration-300"
                  :class="
                    revealed.has(card.position)
                      ? [rarityStyle(card.character.rarityKey).frame, 'border-2']
                      : index === focusIndex
                        ? 'animate-pulse border-sakura-400 bg-sakura-400/10'
                        : 'border-dashed border-night-500 bg-night-900/40'
                  "
                  :data-filled="revealed.has(card.position)"
                >
                  <motion.div
                    v-if="revealed.has(card.position)"
                    class="absolute inset-0"
                    :class="rarityStyle(card.character.rarityKey).bg"
                    :initial="{ scale: 0.4, opacity: 0 }"
                    :animate="{ scale: 1, opacity: 1 }"
                    :transition="{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }"
                  >
                    <img
                      v-if="card.character.imageUrl"
                      :src="card.character.imageUrl"
                      alt=""
                      class="size-full object-cover"
                      loading="lazy"
                    />
                  </motion.div>
                </li>
              </ol>
            </motion.div>

            <motion.div
              v-else
              key="grid"
              class="flex w-full flex-col items-center gap-8"
              :initial="{ opacity: 0 }"
              :animate="{ opacity: 1 }"
              :transition="{ duration: reduced ? 0 : 0.2 }"
            >
              <ul
                class="w-full max-w-6xl"
                :class="
                  compact
                    ? 'grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3 lg:grid-cols-10'
                    : 'flex flex-wrap justify-center gap-3 sm:gap-4'
                "
                data-testid="opening-summary"
              >
                <!-- Dealt from the stack: each card flies from the center to its place -->
                <motion.li
                  v-for="(card, index) in cards"
                  :key="card.position"
                  :class="compact ? '' : 'w-[29%] max-w-48 sm:w-[18%]'"
                  :initial="{
                    opacity: 0,
                    y: -160,
                    scale: 0.55,
                    rotate: ((index % 5) - 2) * 9,
                  }"
                  :animate="{ opacity: 1, y: 0, scale: 1, rotate: 0 }"
                  :transition="{
                    duration: reduced ? 0 : 0.5,
                    delay: dealDelay(index),
                    ease: 'easeOut',
                  }"
                >
                  <TiltCard :max="compact ? 8 : 10">
                    <FlipCard
                      :card="card"
                      :revealed="revealed.has(card.position)"
                      linked
                      @reveal="reveal(card.position)"
                      @navigate="emit('close')"
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
                <button
                  v-else
                  type="button"
                  class="rounded-xl bg-sakura-600 px-6 py-3 font-semibold text-white hover:bg-sakura-700"
                  data-testid="close-opening"
                  @click="emit('close')"
                >
                  {{ t('boosters.done') }}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
