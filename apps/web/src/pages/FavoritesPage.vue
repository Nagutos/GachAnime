<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { ReorderGroup, ReorderItem, useReducedMotion } from 'motion-v'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useFavoritesQuery, useReorderFavoritesMutation } from '@/api/player'
import { useErrorMessage } from '@/app/errors'
import { playFlip } from '@/app/sounds'
import TiltCard from '@/components/booster/TiltCard.vue'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import ChevronIcon from '@/components/ChevronIcon.vue'
import CollectionTabs from '@/components/collection/CollectionTabs.vue'
import FavoriteButton from '@/components/collection/FavoriteButton.vue'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const { t, n } = useI18n()
const favorites = useFavoritesQuery()
const reorder = useReorderFavoritesMutation()
const errorMessage = useErrorMessage(reorder.error)
const data = computed(() => favorites.data.value)

/** Card size of the showcase, remembered in this browser only. */
const SIZES = ['small', 'medium', 'large'] as const
const size = useStorage<(typeof SIZES)[number]>('gachanime.favorites.size', 'medium')
const gridClass = computed(
  () =>
    ({
      small: 'grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8',
      medium: playerUi.cardGrid,
      large: 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
    })[size.value] ?? playerUi.cardGrid,
)

/** Order shown while arranging; differs from the saved one until saved. */
const savedOrder = computed(() => data.value?.items.map((item) => item.id) ?? [])
const order = ref<number[]>([])
watch(savedOrder, (ids) => (order.value = [...ids]), { immediate: true })
const arranging = ref(false)
const dirty = computed(() => order.value.join() !== savedOrder.value.join())
const items = computed(() => {
  const byId = new Map((data.value?.items ?? []).map((item) => [item.id, item]))
  return order.value.flatMap((id) => byId.get(id) ?? [])
})

function move(from: number, to: number): void {
  if (to < 0 || to >= order.value.length || from === to) return
  const next = [...order.value]
  const [id] = next.splice(from, 1)
  next.splice(to, 0, id!)
  order.value = next
}

/**
 * Drag and drop as in the booster opening: the card is picked up (3D tilt, lifted), the others
 * slide out of its way (layout animations) and it settles in its slot when released. Works with
 * a finger too; the page scrolls when the card nears the edge. The arrows do the same from the
 * keyboard.
 */
const reduced = useReducedMotion()
const dragging = ref<number | null>(null)
const transition = computed(() =>
  reduced.value ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 38 },
)
function pickUp(id: number): void {
  dragging.value = id
  visited.clear()
  blockedAt = null
  window.addEventListener('pointermove', trackPointer)
  playFlip(0.6)
}
function drop(): void {
  dragging.value = null
  window.removeEventListener('pointermove', trackPointer)
  playFlip(0.4)
}
onBeforeUnmount(() => window.removeEventListener('pointermove', trackPointer))

/**
 * Hysteresis: a card held where slots meet (the corner between four cards) made the grid cycle
 * through the slots around it, each move re-rendering the grid, which measured the layouts again
 * and asked for the next move: the page froze. An order already shown during this drag comes
 * back only once the pointer has moved away from where that order was shown. A refused move is
 * not rendered (that would feed the loop): ReorderGroup then waits for an update, given when the
 * pointer really moves.
 */
const SETTLE_DISTANCE = 40
const pointer = { x: 0, y: 0 }
const visited = new Map<string, { x: number; y: number }>()
let blockedAt: { x: number; y: number } | null = null
function trackPointer(event: PointerEvent): void {
  pointer.x = event.clientX
  pointer.y = event.clientY
  if (blockedAt && Math.hypot(pointer.x - blockedAt.x, pointer.y - blockedAt.y) >= 12) {
    blockedAt = null
    order.value = [...order.value]
  }
}
function onReorder(next: number[]): void {
  const seen = visited.get(next.join())
  if (seen && Math.hypot(pointer.x - seen.x, pointer.y - seen.y) < SETTLE_DISTANCE) {
    blockedAt = { ...pointer }
    return
  }
  visited.set(order.value.join(), { ...pointer })
  visited.set(next.join(), { ...pointer })
  order.value = next
}

function cancel(): void {
  order.value = [...savedOrder.value]
  arranging.value = false
}

async function save(): Promise<void> {
  if (dirty.value) await reorder.mutateAsync(order.value)
  arranging.value = false
}
</script>

<template>
  <main :class="playerUi.page">
    <RequireSignIn>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 :class="playerUi.title">{{ t('favorites.title') }}</h1>
          <p v-if="data" class="text-mist-300" data-testid="favorites-count">
            {{
              t('favorites.count', {
                count: n(data.items.length, 'integer'),
                max: n(data.maxItems, 'integer'),
              })
            }}
          </p>
        </div>
        <div v-if="data && data.items.length" class="flex flex-wrap items-center gap-2">
          <div
            class="flex rounded-lg border border-night-700 p-0.5"
            role="group"
            :aria-label="t('favorites.size')"
          >
            <button
              v-for="value in SIZES"
              :key="value"
              type="button"
              class="rounded-md px-3 py-1.5 text-sm"
              :class="
                size === value
                  ? 'bg-night-700 font-semibold text-mist-100'
                  : 'text-mist-300 hover:text-mist-100'
              "
              :aria-pressed="size === value"
              :data-testid="`favorites-size-${value}`"
              @click="size = value"
            >
              {{ t(`favorites.sizes.${value}`) }}
            </button>
          </div>
          <template v-if="arranging">
            <button
              type="button"
              class="rounded-xl border border-night-700 bg-night-800 px-4 py-2 font-semibold hover:bg-night-700"
              @click="cancel"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700 disabled:opacity-50"
              :disabled="reorder.isPending.value"
              data-testid="favorites-save"
              @click="save"
            >
              {{ t('favorites.saveOrder') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="rounded-xl border border-night-700 bg-night-800 px-4 py-2 font-semibold hover:bg-night-700"
            data-testid="favorites-arrange"
            @click="arranging = true"
          >
            {{ t('favorites.arrange') }}
          </button>
        </div>
      </header>

      <CollectionTabs />

      <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
      <p v-if="arranging" class="text-sm text-mist-300">{{ t('favorites.arrangeHelp') }}</p>
      <p v-else-if="data?.items.length" class="text-sm text-mist-300">
        {{ t('favorites.mainHint') }}
      </p>

      <p v-if="favorites.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <div
        v-else-if="data && data.items.length === 0"
        :class="[playerUi.panel, 'flex flex-col items-center gap-3 text-center']"
      >
        <p>{{ t('favorites.empty') }}</p>
        <RouterLink
          :to="{ name: 'collection' }"
          class="rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700"
        >
          {{ t('favorites.browseCollection') }}
        </RouterLink>
      </div>
      <ReorderGroup
        v-else-if="data"
        :values="order"
        as="ol"
        :class="gridClass"
        data-testid="favorites-grid"
        @update:values="onReorder"
      >
        <ReorderItem
          v-for="(item, index) in items"
          :key="item.id"
          :value="item.id"
          layout="position"
          class="relative"
          :class="{ 'cursor-grab touch-none active:cursor-grabbing': arranging }"
          :drag="arranging"
          :drag-elastic="0.7"
          :while-drag="{ scale: 1.08 }"
          :transition="transition"
          :data-testid="`favorite-${item.id}`"
          :on-drag-start="() => pickUp(item.id)"
          :on-drag-end="drop"
          @dragstart.prevent
        >
          <component :is="arranging ? TiltCard : 'div'">
            <CharacterCard
              :to="arranging ? undefined : { name: 'wiki-character', params: { id: item.id } }"
              :name="item.name"
              :image-url="item.imageUrl"
              :rarity-key="item.rarityKey"
              :series="item.series"
              :quantity="item.quantity"
              :class="[
                { 'transition hover:-translate-y-1': !arranging },
                { 'opacity-60 grayscale': item.quantity === 0 },
              ]"
            />
          </component>
          <div
            v-if="arranging && dragging === null"
            class="absolute inset-x-1.5 top-1/2 flex -translate-y-1/2 justify-between"
          >
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-full border border-night-500 bg-night-950/85 text-mist-100 hover:border-sakura-400 disabled:opacity-30"
              :disabled="index === 0"
              :aria-label="t('favorites.moveEarlier', { name: item.name })"
              data-testid="favorite-earlier"
              @pointerdown.stop
              @click="move(index, index - 1)"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-full border border-night-500 bg-night-950/85 text-mist-100 hover:border-sakura-400 disabled:opacity-30"
              :disabled="index === items.length - 1"
              :aria-label="t('favorites.moveLater', { name: item.name })"
              data-testid="favorite-later"
              @pointerdown.stop
              @click="move(index, index + 1)"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
          <span
            class="pointer-events-none absolute bottom-13 left-1.5 flex size-6 items-center justify-center rounded-full bg-night-950/85 text-xs font-bold text-gold-400 tabular-nums"
            aria-hidden="true"
          >
            {{ index + 1 }}
          </span>
          <FavoriteButton
            v-if="!arranging"
            class="absolute right-1.5 bottom-12"
            :character-id="item.id"
            :favorite="true"
          />
        </ReorderItem>
      </ReorderGroup>
    </RequireSignIn>
  </main>
</template>
