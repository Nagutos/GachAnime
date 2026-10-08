<script setup lang="ts">
import {
  genderClassSchema,
  type AdminCharacter,
  type CatalogSource,
  type GenderClassValue,
} from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useCharacterListQuery } from '@/api/admin'
import AppSelect from '@/components/AppSelect.vue'
import AdminPagination from '../components/AdminPagination.vue'
import CharacterFormDialog from '../components/CharacterFormDialog.vue'
import CharacterTable from '../components/CharacterTable.vue'
import { useRarities } from '../use-rarities'
import { ui } from '../ui'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { rarities, nameOf } = useRarities()
const PAGE_SIZE = 50

const queryText = (key: string) => (typeof route.query[key] === 'string' ? route.query[key] : '')
const search = ref(queryText('search'))
const debouncedSearch = refDebounced(search, 300)
const rarity = ref(queryText('rarity'))
const initialGender = genderClassSchema.safeParse(route.query.gender)
const gender = ref<GenderClassValue | ''>(initialGender.success ? initialGender.data : '')
const source = ref<CatalogSource | ''>('')
const status = ref<'' | 'true' | 'false'>('')
const overridden = ref<'' | 'true' | 'false'>('')
const sort = ref<'favourites' | 'name' | 'recent'>('favourites')
const page = ref(1)

watch([debouncedSearch, rarity, gender, source, status, overridden, sort], () => {
  page.value = 1
  // Keep shareable filters in the URL (dashboard links use them).
  void router.replace({
    query: {
      ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
      ...(rarity.value ? { rarity: rarity.value } : {}),
      ...(gender.value ? { gender: gender.value } : {}),
    },
  })
})

const list = useCharacterListQuery(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  search: debouncedSearch.value || undefined,
  rarity: rarity.value || undefined,
  gender: gender.value || undefined,
  source: source.value || undefined,
  active: status.value === '' ? undefined : status.value === 'true',
  overridden: overridden.value === '' ? undefined : overridden.value === 'true',
  sort: sort.value,
}))
const items = computed(() => list.data.value?.items ?? [])

const formOpen = ref(false)
const edited = ref<AdminCharacter | null>(null)
function edit(character: AdminCharacter): void {
  edited.value = character
  formOpen.value = true
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="font-display text-3xl font-bold">{{ t('admin.characters.title') }}</h1>
    <div class="flex flex-wrap items-end gap-3">
      <label :class="[ui.label, 'min-w-56 flex-1']">
        {{ t('admin.common.search') }}
        <input
          v-model="search"
          type="search"
          :placeholder="t('admin.characters.searchPlaceholder')"
          :class="ui.input"
        />
      </label>
      <label :class="ui.label">
        {{ t('admin.characters.rarity') }}
        <AppSelect
          v-model="rarity"
          :options="[
            { value: '', label: t('admin.common.all') },
            ...rarities.map((item) => ({ value: item.key, label: nameOf(item.key) })),
          ]"
          data-testid="filter-rarity"
        />
      </label>
      <label :class="ui.label">
        {{ t('admin.characters.gender') }}
        <AppSelect
          v-model="gender"
          :options="[
            { value: '', label: t('admin.common.all') },
            ...genderClassSchema.options.map((value) => ({
              value,
              label: t(`admin.genders.${value}`),
            })),
          ]"
          data-testid="filter-gender"
        />
      </label>
      <label :class="ui.label">
        {{ t('admin.characters.source') }}
        <AppSelect
          v-model="source"
          :options="[
            { value: '', label: t('admin.common.all') },
            ...(['anilist', 'manual'] as const).map((value) => ({
              value,
              label: t(`admin.sources.${value}`),
            })),
          ]"
        />
      </label>
      <label :class="ui.label">
        {{ t('admin.characters.override') }}
        <AppSelect
          v-model="overridden"
          :options="[
            { value: '', label: t('admin.common.all') },
            { value: 'true', label: t('admin.characters.overrideOptions.true') },
            { value: 'false', label: t('admin.characters.overrideOptions.false') },
          ]"
        />
      </label>
      <label :class="ui.label">
        {{ t('admin.characters.status') }}
        <AppSelect
          v-model="status"
          :options="[
            { value: '', label: t('admin.common.all') },
            { value: 'true', label: t('admin.common.active') },
            { value: 'false', label: t('admin.common.inactive') },
          ]"
        />
      </label>
      <label :class="ui.label">
        {{ t('admin.characters.sort') }}
        <AppSelect
          v-model="sort"
          :options="
            (['favourites', 'name', 'recent'] as const).map((value) => ({
              value,
              label: t(`admin.characters.sorts.${value}`),
            }))
          "
        />
      </label>
    </div>
    <CharacterTable :items="items" @edit="edit" />
    <AdminPagination
      v-if="list.data.value"
      v-model:page="page"
      :page-size="PAGE_SIZE"
      :total="list.data.value.total"
    />
    <CharacterFormDialog v-model:open="formOpen" :character="edited" />
  </div>
</template>
