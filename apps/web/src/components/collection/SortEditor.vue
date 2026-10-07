<script setup lang="ts">
import { COLLECTION_SORT_KEYS, type CollectionSort } from '@gachanime/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { playerUi } from '@/components/ui'

const MAX_KEYS = 3
const sorts = defineModel<CollectionSort[]>({ required: true })
const { t } = useI18n()

const unused = computed(() =>
  COLLECTION_SORT_KEYS.filter((key) => !sorts.value.some((sort) => sort.key === key)),
)

function update(index: number, change: Partial<CollectionSort>): void {
  sorts.value = sorts.value.map((sort, i) => (i === index ? { ...sort, ...change } : sort))
}

function add(): void {
  const key = unused.value[0]
  if (key) sorts.value = [...sorts.value, { key, direction: key === 'name' ? 'asc' : 'desc' }]
}

function remove(index: number): void {
  sorts.value = sorts.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="t('collection.sort')">
    <span class="text-sm text-mist-300">{{ t('collection.sort') }}</span>
    <div
      v-for="(sort, index) in sorts"
      :key="sort.key"
      class="flex items-center gap-1 rounded-lg border border-night-700 bg-night-950 pl-1"
    >
      <select
        :value="sort.key"
        :class="[playerUi.select, 'border-0 bg-transparent']"
        :aria-label="t('collection.sortKey', { index: index + 1 })"
        @change="
          update(index, {
            key: ($event.target as HTMLSelectElement).value as CollectionSort['key'],
          })
        "
      >
        <option
          v-for="key in COLLECTION_SORT_KEYS"
          :key="key"
          :value="key"
          :disabled="key !== sort.key && !unused.includes(key)"
        >
          {{ t(`collection.sorts.${key}`) }}
        </option>
      </select>
      <button
        type="button"
        class="rounded px-2 py-1 text-sm text-mist-300 hover:text-mist-100"
        :aria-label="t(`collection.directions.${sort.direction}`)"
        :title="t(`collection.directions.${sort.direction}`)"
        @click="update(index, { direction: sort.direction === 'asc' ? 'desc' : 'asc' })"
      >
        {{ sort.direction === 'asc' ? '↑' : '↓' }}
      </button>
      <button
        v-if="sorts.length > 1"
        type="button"
        class="rounded px-2 py-1 text-sm text-mist-300 hover:text-rarity-mythic"
        :aria-label="t('collection.removeSort')"
        @click="remove(index)"
      >
        ✕
      </button>
    </div>
    <button
      v-if="sorts.length < MAX_KEYS && unused.length > 0"
      type="button"
      class="rounded-lg border border-dashed border-night-500 px-2 py-1.5 text-sm text-mist-300 hover:text-mist-100"
      @click="add"
    >
      {{ t('collection.addSort') }}
    </button>
  </div>
</template>
