<script setup lang="ts">
import { THEME_CATEGORIES, type AdminTheme, type ThemeRule } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import {
  useAdminThemesQuery,
  useDeleteThemeMutation,
  useSaveThemeMutation,
  useThemePreviewQuery,
  useThemeRuleOptionsQuery,
} from '@/api/admin'
import { useErrorMessage } from '@/app/errors'
import { rarityStyle } from '@/components/cards/rarity-styles'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ObjectiveTextFields from '../components/ObjectiveTextFields.vue'
import RuleEditor from '../components/RuleEditor.vue'
import { cleanLocalized } from '../text'
import { ui } from '../ui'

interface Draft {
  key: string
  name: { en: string; fr?: string }
  description: { en: string; fr?: string }
  category: AdminTheme['category']
  rules: ThemeRule
  freeEnabled: boolean
  paidEnabled: boolean
  surchargePercent: number
  artToken: string
  isActive: boolean
  sortOrder: number
}

/** Undefined id: a new pack. */
const props = defineProps<{ id?: number }>()
const { t, n } = useI18n()
const router = useRouter()
const themes = useAdminThemesQuery()
const options = useThemeRuleOptionsQuery()
const save = useSaveThemeMutation()
const remove = useDeleteThemeMutation()
const errorMessage = useErrorMessage(save.error)
const confirmDelete = ref(false)
const saved = ref(false)

const existing = computed(() =>
  props.id ? themes.data.value?.themes.find((theme) => theme.id === props.id) : undefined,
)
const draft = ref<Draft | null>(null)
watch(
  [existing, () => props.id],
  ([theme]) => {
    if (props.id && !theme) return
    if (draft.value && theme && draft.value.key === theme.key) return
    draft.value = theme
      ? {
          key: theme.key,
          name: { ...theme.name } as Draft['name'],
          description: { en: '', ...(theme.description ?? {}) },
          category: theme.category,
          rules: JSON.parse(JSON.stringify(theme.rules)) as ThemeRule,
          freeEnabled: theme.freeEnabled,
          paidEnabled: theme.paidEnabled,
          surchargePercent: theme.surchargePercent,
          artToken: theme.artToken,
          isActive: theme.isActive,
          sortOrder: theme.sortOrder,
        }
      : {
          key: '',
          name: { en: '' },
          description: { en: '' },
          category: 'custom',
          rules: { type: 'group', mode: 'all', rules: [] },
          freeEnabled: true,
          paidEnabled: true,
          surchargePercent: 20,
          artToken: 'default',
          isActive: true,
          sortOrder: 0,
        }
  },
  { immediate: true },
)

const rules = computed(() => draft.value?.rules ?? null)
const debouncedRules = refDebounced(rules, 400)
const preview = useThemePreviewQuery(debouncedRules)

async function submit(): Promise<void> {
  const value = draft.value
  if (!value) return
  saved.value = false
  const description = cleanLocalized(value.description)
  const fields = {
    name: cleanLocalized(value.name),
    description: description.en ? description : null,
    category: value.category,
    rules: value.rules,
    freeEnabled: value.freeEnabled,
    paidEnabled: value.paidEnabled,
    surchargePercent: value.surchargePercent,
    artToken: value.artToken,
    isActive: value.isActive,
    sortOrder: value.sortOrder,
  }
  const id = await save.mutateAsync(
    props.id ? { id: props.id, changes: fields } : { create: { ...fields, key: value.key } },
  )
  saved.value = true
  if (!props.id) void router.replace({ name: 'admin-theme-edit', params: { id } })
}

async function deleteTheme(): Promise<void> {
  if (!props.id) return
  await remove.mutateAsync(props.id)
  void router.push({ name: 'admin-themes' })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <RouterLink :to="{ name: 'admin-themes' }" class="text-sm text-mist-300 hover:text-sakura-400">
      {{ t('admin.themes.back') }}
    </RouterLink>
    <h1 class="font-display text-3xl font-bold">
      {{ id ? t('admin.themes.edit') : t('admin.themes.new') }}
    </h1>
    <p v-if="!draft || options.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <div v-else class="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <form :class="[ui.card, 'flex flex-col gap-4']" @submit.prevent="submit">
        <label v-if="!id" :class="ui.label">
          {{ t('admin.objectives.key') }}
          <input
            v-model.trim="draft.key"
            required
            pattern="[a-z][a-z0-9_\-]{1,63}"
            :class="ui.input"
            data-testid="theme-key"
          />
        </label>
        <ObjectiveTextFields v-model:name="draft.name" v-model:description="draft.description" />
        <div class="grid gap-3 sm:grid-cols-3">
          <label :class="ui.label">
            {{ t('admin.themes.category') }}
            <select v-model="draft.category" :class="ui.select">
              <option v-for="category in THEME_CATEGORIES" :key="category" :value="category">
                {{ t(`boosters.packs.categories.${category}`) }}
              </option>
            </select>
          </label>
          <label :class="ui.label">
            {{ t('admin.themes.surcharge') }}
            <input
              v-model.number="draft.surchargePercent"
              type="number"
              min="0"
              max="1000"
              :class="ui.input"
            />
          </label>
          <label :class="ui.label">
            {{ t('admin.boosters.sortOrder') }}
            <input v-model.number="draft.sortOrder" type="number" min="0" :class="ui.input" />
          </label>
        </div>
        <div class="flex flex-wrap gap-4 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="draft.freeEnabled" type="checkbox" class="accent-sakura-500" />
            {{ t('admin.themes.freeEnabled') }}
          </label>
          <label class="flex items-center gap-2">
            <input v-model="draft.paidEnabled" type="checkbox" class="accent-sakura-500" />
            {{ t('admin.themes.paidEnabled') }}
          </label>
          <label class="flex items-center gap-2">
            <input v-model="draft.isActive" type="checkbox" class="accent-sakura-500" />
            {{ t('admin.common.active') }}
          </label>
        </div>
        <div class="flex flex-col gap-2">
          <h2 class="font-display text-lg font-bold">{{ t('admin.themes.rules.title') }}</h2>
          <p class="text-sm text-mist-300">{{ t('admin.themes.rules.help') }}</p>
          <RuleEditor v-model="draft.rules" :options="options.data.value!" />
        </div>
        <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button v-if="id" type="button" :class="ui.buttonDanger" @click="confirmDelete = true">
            {{ t('admin.common.delete') }}
          </button>
          <span v-else />
          <div class="flex items-center gap-3">
            <span v-if="saved" class="text-sm text-emerald-400">{{ t('admin.common.saved') }}</span>
            <button
              type="submit"
              :class="ui.buttonPrimary"
              :disabled="save.isPending.value"
              data-testid="save-theme"
            >
              {{ t('admin.common.save') }}
            </button>
          </div>
        </div>
      </form>

      <aside :class="[ui.card, 'flex flex-col gap-4 self-start']" data-testid="theme-preview">
        <h2 class="font-display text-lg font-bold">{{ t('admin.themes.preview') }}</h2>
        <template v-if="preview.data.value">
          <p class="font-display text-3xl font-bold tabular-nums">
            {{ t('admin.themes.previewTotal', { count: n(preview.data.value.total, 'integer') }) }}
          </p>
          <ul class="flex flex-col gap-1 text-sm">
            <li
              v-for="row in [...preview.data.value.byRarity].reverse()"
              :key="row.rarityKey"
              class="flex justify-between"
            >
              <span :class="rarityStyle(row.rarityKey).text">{{ row.rarityKey }}</span>
              <span class="tabular-nums" :class="{ 'text-rarity-mythic': row.count === 0 }">
                {{ n(row.count, 'integer') }}
              </span>
            </li>
          </ul>
          <p
            v-if="preview.data.value.emptyRarities.length"
            class="rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-sm text-gold-400"
          >
            {{
              t('admin.themes.emptyRarities', {
                rarities: preview.data.value.emptyRarities.join(', '),
              })
            }}
          </p>
          <ul class="grid grid-cols-4 gap-2">
            <li v-for="sample in preview.data.value.samples" :key="sample.id" :title="sample.name">
              <img
                v-if="sample.imageUrl"
                :src="sample.imageUrl"
                :alt="sample.name"
                referrerpolicy="no-referrer"
                class="aspect-5/7 w-full rounded-md border object-cover"
                :class="rarityStyle(sample.rarityKey).frame"
              />
              <div
                v-else
                class="flex aspect-5/7 items-center justify-center rounded-md bg-night-800 text-[10px]"
              >
                {{ sample.name }}
              </div>
            </li>
          </ul>
        </template>
        <p v-else class="text-mist-300">{{ t('common.loading') }}</p>
      </aside>
    </div>
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="t('admin.themes.deleteTitle')"
      :description="t('admin.themes.deleteBody')"
      danger
      @confirm="deleteTheme"
    />
  </div>
</template>
