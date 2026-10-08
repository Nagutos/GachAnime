<script setup lang="ts">
import { useReducedMotion } from 'motion-v'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TiltCard from '@/components/booster/TiltCard.vue'
import CardBack from './CardBack.vue'

/** A card to play with (wiki page): it tilts under the pointer and turns over on click. */
const { t } = useI18n()
const reduced = useReducedMotion()
const turned = ref(false)
</script>

<template>
  <TiltCard :max="12">
    <button
      type="button"
      class="block w-full cursor-pointer perspective-distant"
      :aria-pressed="turned"
      :aria-label="t('cards.turn')"
      :title="t('cards.turn')"
      data-testid="turnable-card"
      @click="turned = !turned"
    >
      <!-- Same CSS flip as an opening (FlipCard): `is-revealed` shows the face -->
      <div
        class="flip-inner relative transform-3d"
        :class="{ 'is-revealed': !turned }"
        :style="{ '--flip-duration': reduced ? '0s' : '0.6s' }"
      >
        <div class="backface-hidden">
          <CardBack />
        </div>
        <div class="absolute inset-0 rotate-y-180 backface-hidden">
          <slot />
        </div>
      </div>
    </button>
  </TiltCard>
</template>
