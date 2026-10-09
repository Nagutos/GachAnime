<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRecycleDuplicatesMutation, useRecyclePreviewQuery } from '@/api/player'
import { ApiError } from '@/api/client'
import { useErrorMessage } from '@/app/errors'
import { usePlayerRarities } from '@/app/rarities'
import BaseDialog from '@/components/BaseDialog.vue'
import { rarityStyle } from '@/components/cards/rarity-styles'
import { playerUi } from '@/components/ui'

const open = defineModel<boolean>('open', { required: true })
const { t, n } = useI18n()
const { rarities, nameOf } = usePlayerRarities()

const selected = ref<string[]>([])
watch(
  rarities,
  (list) => {
    if (selected.value.length === 0) selected.value = list.map((rarity) => rarity.key)
  },
  { immediate: true },
)
const filter = computed(() =>
  selected.value.length === rarities.value.length ? [] : [...selected.value].sort(),
)
/** Duplicates of favorites are kept unless the player asks. */
const includeFavorites = ref(false)
const preview = useRecyclePreviewQuery(filter, includeFavorites, open)
const recycle = useRecycleDuplicatesMutation()
const errorMessage = useErrorMessage(recycle.error)
const done = ref<{ cards: number; gems: number } | null>(null)

watch(open, (value) => {
  if (value) {
    done.value = null
    recycle.reset()
  }
})

async function confirm(): Promise<void> {
  const current = preview.data.value
  if (!current || current.cards === 0) return
  try {
    const result = await recycle.mutateAsync({
      rarities: filter.value.length ? filter.value : undefined,
      includeFavorites: includeFavorites.value || undefined,
      expected: { cards: current.cards, gems: current.gems },
    })
    done.value = { cards: result.cards, gems: result.gems }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PREVIEW_OUTDATED') void preview.refetch()
  }
}
</script>

<template>
  <BaseDialog
    v-model:open="open"
    :title="t('recycle.title')"
    :description="t('recycle.description')"
  >
    <div v-if="done" class="flex flex-col gap-4" data-testid="recycle-done">
      <p class="text-lg">
        {{
          t(
            'recycle.done',
            {
              cards: n(done.cards, 'integer'),
              gems: n(done.gems, 'integer'),
            },
            done.cards,
          )
        }}
      </p>
      <button
        type="button"
        class="self-end rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white"
        @click="open = false"
      >
        {{ t('common.close') }}
      </button>
    </div>
    <template v-else>
      <fieldset class="flex flex-wrap gap-3">
        <legend class="mb-2 text-sm text-mist-300">{{ t('recycle.rarities') }}</legend>
        <label
          v-for="rarity in rarities"
          :key="rarity.key"
          class="flex items-center gap-2 rounded-lg border border-night-700 px-3 py-1.5 text-sm"
        >
          <input v-model="selected" type="checkbox" :value="rarity.key" class="accent-sakura-500" />
          <span :class="rarityStyle(rarity.key).text">{{ nameOf(rarity.key) }}</span>
        </label>
      </fieldset>
      <label class="flex items-center gap-2 text-sm text-mist-300">
        <input
          v-model="includeFavorites"
          type="checkbox"
          class="accent-sakura-500"
          data-testid="recycle-include-favorites"
        />
        {{ t('recycle.includeFavorites') }}
      </label>

      <p v-if="preview.isFetching.value && !preview.data.value" class="text-mist-300">
        {{ t('common.loading') }}
      </p>
      <div v-else-if="preview.data.value" class="flex flex-col gap-2" data-testid="recycle-preview">
        <p v-if="preview.data.value.cards === 0" class="text-mist-300">
          {{ t('recycle.nothing') }}
        </p>
        <template v-else>
          <ul class="flex flex-col gap-1 text-sm">
            <li
              v-for="row in preview.data.value.byRarity"
              :key="row.rarityKey"
              class="flex justify-between gap-3"
            >
              <span :class="rarityStyle(row.rarityKey).text">{{ nameOf(row.rarityKey) }}</span>
              <span class="tabular-nums">
                {{
                  t(
                    'recycle.row',
                    { cards: n(row.cards, 'integer'), gems: n(row.gems, 'integer') },
                    row.cards,
                  )
                }}
              </span>
            </li>
          </ul>
          <p class="border-t border-night-700 pt-2 font-semibold">
            {{
              t(
                'recycle.total',
                {
                  cards: n(preview.data.value.cards, 'integer'),
                  characters: n(preview.data.value.characters, 'integer'),
                  gems: n(preview.data.value.gems, 'integer'),
                },
                preview.data.value.cards,
              )
            }}
          </p>
          <p class="text-xs text-mist-300">{{ t('recycle.keepsFirst') }}</p>
        </template>
      </div>

      <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="rounded-xl border border-night-700 px-4 py-2"
          @click="open = false"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-xl bg-sakura-600 px-4 py-2 font-semibold text-white hover:bg-sakura-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="
            !preview.data.value?.cards || recycle.isPending.value || preview.isFetching.value
          "
          data-testid="recycle-confirm"
          @click="confirm"
        >
          {{ t('recycle.confirm', { gems: n(preview.data.value?.gems ?? 0, 'integer') }) }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>
