<script setup lang="ts">
import type { OpenedCard } from '@gachanime/shared'
import { motion, useReducedMotion } from 'motion-v'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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
  }>(),
  { advance: false },
)
const emit = defineEmits<{ reveal: []; next: [] }>()

const { t } = useI18n()
const { nameOf } = usePlayerRarities()
const reduced = useReducedMotion()
const rarity = computed(() => props.card.character.rarityKey)
const style = computed(() => rarityStyle(rarity.value))
const highlight = computed(() => HIGHLIGHT_RARITIES.has(rarity.value))
const shiny = computed(() => SHINY_RARITIES.has(rarity.value))
/** Higher rarities flip a bit slower, for suspense. */
const flipDuration = computed(() => (reduced.value ? 0 : shiny.value ? 0.9 : 0.5))
</script>

<template>
  <button
    type="button"
    class="group relative block w-full perspective-distant"
    :aria-label="
      revealed
        ? t('boosters.revealedCard', {
            name: card.character.name,
            rarity: nameOf(rarity),
          })
        : t('boosters.revealCard')
    "
    :aria-disabled="revealed && !advance"
    data-testid="flip-card"
    :data-character-id="revealed ? card.character.id : undefined"
    :data-revealed="revealed"
    @click="revealed ? advance && emit('next') : emit('reveal')"
  >
    <!-- Burst of light behind legendary and mythic reveals -->
    <motion.div
      v-if="shiny && revealed && !reduced"
      class="reveal-rays pointer-events-none absolute -inset-1/2"
      :class="style.text"
      :initial="{ scale: 0.2, opacity: 0, rotate: 0 }"
      :animate="{ scale: 1.3, opacity: [0, 0.9, 0], rotate: 40 }"
      :transition="{ duration: 1.6, ease: 'easeOut', delay: flipDuration * 0.5 }"
    />
    <motion.div
      class="relative transform-3d"
      :animate="{ rotateY: revealed ? 180 : 0, scale: revealed && highlight ? [1, 1.08, 1] : 1 }"
      :transition="{ duration: flipDuration, ease: 'easeInOut' }"
    >
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
          :series-title="card.character.series?.title"
          :is-new="card.isNew"
          :class="highlight ? ['shadow-[0_0_32px_4px]', style.glow] : null"
        />
      </div>
    </motion.div>
  </button>
</template>
