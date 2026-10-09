<script setup lang="ts">
import type { OpenedCard } from '@gachanime/shared'
import { useReducedMotion } from 'motion-v'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { usePlayerRarities } from '@/app/rarities'
import CardBack from '@/components/cards/CardBack.vue'
import CharacterCard from '@/components/cards/CharacterCard.vue'
import { HIGHLIGHT_RARITIES, rarityStyle, SHINY_RARITIES } from '@/components/cards/rarity-styles'

const props = withDefaults(
  defineProps<{
    card: OpenedCard
    revealed: boolean
    /** Once revealed, a click asks for the next card (one-by-one reveal). */
    advance?: boolean
    /** Once revealed, the card links to its wiki page (final grid of an opening). */
    linked?: boolean
    /** An aura of the rarity color spreads around the card when it is revealed. */
    aura?: boolean
    /**
     * Flat rendering for phones showing many cards: no 3D flip, no glow or animated sheen (dozens
     * of 3D layers made mobile GPUs flicker). The revealed face simply fades in.
     */
    lite?: boolean
  }>(),
  { advance: false, linked: false, aura: false, lite: false },
)
const emit = defineEmits<{ reveal: []; next: []; navigate: [] }>()
const asLink = computed(() => props.revealed && props.linked)

const { t } = useI18n()
const { nameOf } = usePlayerRarities()
const reduced = useReducedMotion()
const rarity = computed(() => props.card.character.rarityKey)
const style = computed(() => rarityStyle(rarity.value))
const highlight = computed(() => HIGHLIGHT_RARITIES.has(rarity.value))
const shiny = computed(() => SHINY_RARITIES.has(rarity.value))
/** Higher rarities flip a bit slower, for suspense. */
const flipDuration = computed(() => (reduced.value ? 0 : shiny.value ? 0.9 : 0.5))

/**
 * The aura plays once, when the card is revealed while shown (not for cards mounted already
 * revealed), then its layers are removed.
 */
const auraVisible = ref(false)
let auraTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => props.revealed,
  (revealed, before) => {
    if (!revealed || before || !props.aura || reduced.value) return
    auraVisible.value = true
    clearTimeout(auraTimer)
    auraTimer = setTimeout(() => (auraVisible.value = false), 2600)
  },
)
onBeforeUnmount(() => clearTimeout(auraTimer))
const auraRings = computed(() => (shiny.value ? 3 : highlight.value ? 2 : 1))
const auraStyle = computed(() => ({
  '--aura': `var(--color-rarity-${rarity.value}, var(--color-rarity-common))`,
}))
</script>

<template>
  <component
    :is="asLink ? RouterLink : 'button'"
    :type="asLink ? undefined : 'button'"
    :to="asLink ? { name: 'wiki-character', params: { id: card.character.id } } : undefined"
    class="group relative block w-full perspective-distant"
    :aria-label="
      revealed
        ? t('boosters.revealedCard', {
            name: card.character.name,
            rarity: nameOf(rarity),
          })
        : t('boosters.revealCard')
    "
    :aria-disabled="asLink ? undefined : revealed && !advance"
    data-testid="flip-card"
    :data-character-id="revealed ? card.character.id : undefined"
    :data-rarity="revealed ? rarity : undefined"
    :data-revealed="revealed"
    @click="asLink ? emit('navigate') : revealed ? advance && emit('next') : emit('reveal')"
  >
    <!-- Aura of the rarity color, fading out in waves around the card -->
    <template v-if="auraVisible && !lite">
      <span
        class="aura-glow pointer-events-none absolute"
        :style="{ ...auraStyle, animationDelay: `${flipDuration * 0.5}s` }"
        aria-hidden="true"
      />
      <span
        v-for="ring in auraRings"
        :key="ring"
        class="aura-ring pointer-events-none absolute inset-0 rounded-xl"
        :style="{ ...auraStyle, animationDelay: `${flipDuration * 0.5 + (ring - 1) * 0.22}s` }"
        aria-hidden="true"
      />
    </template>
    <div v-if="lite" class="relative">
      <CardBack v-if="!revealed" />
      <CharacterCard
        v-else
        class="flip-fade"
        :name="card.character.name"
        :image-url="card.character.imageUrl"
        :rarity-key="rarity"
        :series="card.character.series"
        :is-new="card.isNew"
        :effects="false"
      />
    </div>
    <!-- CSS flip (no JavaScript animation per card: a grid can hold 50 of them) -->
    <div
      v-else
      class="relative"
      :class="{ 'flip-pop': revealed && highlight && !reduced }"
      :style="{ '--flip-duration': `${flipDuration}s` }"
    >
      <div class="flip-inner relative transform-3d" :class="{ 'is-revealed': revealed }">
        <div
          class="backface-hidden"
          :class="
            highlight && !revealed
              ? ['rounded-xl shadow-[0_0_28px_2px] transition-shadow', style.glow]
              : null
          "
        >
          <CardBack class="transition group-hover:-translate-y-1" />
        </div>
        <div class="absolute inset-0 rotate-y-180 backface-hidden">
          <CharacterCard
            :name="card.character.name"
            :image-url="card.character.imageUrl"
            :rarity-key="rarity"
            :series="card.character.series"
            :is-new="card.isNew"
            :class="highlight ? ['shadow-[0_0_32px_4px]', style.glow] : null"
          />
        </div>
      </div>
    </div>
  </component>
</template>
