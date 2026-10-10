<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { usePoolSeriesQuery } from '@/api/player'
import BaseDialog from '@/components/BaseDialog.vue'
import { playerUi } from '@/components/ui'

/**
 * Series a booster can draw from, before opening it: a button with their count, opening the
 * full list (searchable, with the player's progress) in a dialog.
 */
const props = defineProps<{ theme: string | null; label: string }>()
const { t, n } = useI18n()
const dialogOpen = ref(false)
const query = usePoolSeriesQuery(() => props.theme)
const series = computed(() => query.data.value?.series ?? [])

const search = ref('')
const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return term
    ? series.value.filter((row) => row.title.toLocaleLowerCase().includes(term))
    : series.value
})
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="pool-series">
    <button
      type="button"
      class="w-fit text-sm font-semibold text-sakura-400 hover:underline"
      data-testid="pool-series-open"
      @click="dialogOpen = true"
    >
      {{
        query.data.value
          ? t('boosters.series.showAll', { count: n(series.length, 'integer') }, series.length)
          : t('boosters.series.show')
      }}
    </button>

    <BaseDialog
      v-model:open="dialogOpen"
      :title="t('boosters.series.dialogTitle', { pack: label })"
      :description="t('boosters.series.dialogHelp')"
      wide
    >
      <input
        v-model="search"
        type="search"
        :class="playerUi.input"
        :placeholder="t('boosters.series.search')"
        :aria-label="t('boosters.series.search')"
      />
      <p v-if="query.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
      <p v-else-if="filtered.length === 0" class="text-mist-300">{{ t('boosters.series.none') }}</p>
      <ul v-else class="grid gap-2 sm:grid-cols-2" data-testid="pool-series-list">
        <li v-for="row in filtered" :key="row.id">
          <RouterLink
            :to="{ name: 'wiki-series', params: { id: row.id } }"
            class="flex items-center gap-3 rounded-xl border border-night-700 bg-night-950/60 p-2 hover:border-sakura-400/60"
          >
            <img
              v-if="row.coverUrl"
              :src="row.coverUrl"
              alt=""
              class="h-12 w-9 shrink-0 rounded-md object-cover"
              loading="lazy"
            />
            <span v-else class="h-12 w-9 shrink-0 rounded-md bg-night-800" aria-hidden="true" />
            <span class="flex min-w-0 flex-col">
              <span class="truncate text-sm font-semibold">{{ row.title }}</span>
              <span class="text-xs text-mist-300 tabular-nums">
                {{
                  t('boosters.series.progress', {
                    owned: n(row.owned, 'integer'),
                    total: n(row.characters, 'integer'),
                  })
                }}
              </span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </BaseDialog>
  </div>
</template>
