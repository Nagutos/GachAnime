<script setup lang="ts">
import {
  resolveLocalizedText,
  THEME_CATEGORIES,
  type AdminTheme,
  type ThemeRule,
} from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  useAdminThemesQuery,
  useDeleteThemeMutation,
  useSaveThemeMutation,
  useThemePreviewQuery,
  useThemeRuleOptionsQuery,
} from '@/api/admin'
import { useBoostersQuery } from '@/api/player'
import { useErrorMessage } from '@/app/errors'
import AppSelect from '@/components/AppSelect.vue'
import BackLink from '@/components/BackLink.vue'
import BoosterPack from '@/components/booster/BoosterPack.vue'
import { rarityStyle } from '@/components/cards/rarity-styles'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ObjectiveTextFields from '../components/ObjectiveTextFields.vue'
import PackColorPicker from '../components/PackColorPicker.vue'
import RuleEditor from '../components/RuleEditor.vue'
import { firstFreePackColor } from '../pack-colors'
import { cleanLocalized } from '../text'
import SealMark from '@/components/SealMark.vue'
import { ui } from '../ui'

interface Draft {
  key: string
  name: { en: string; fr?: string }
  description: { en: string; fr?: string }
  category: AdminTheme['category']
  rules: ThemeRule
  seal: string
  color: string
  isActive: boolean
}

/** Undefined id: a new pack. */
const props = defineProps<{ id?: number }>()
const { t, n, locale } = useI18n()
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
/** Colors of the other packs, so the admin can tell packs apart in the shop. */
const usedColors = computed(() => {
  const used = new Map<string, string[]>()
  for (const theme of themes.data.value?.themes ?? []) {
    if (theme.id === props.id) continue
    used.set(theme.color, [
      ...(used.get(theme.color) ?? []),
      resolveLocalizedText(theme.name, locale.value),
    ])
  }
  return used
})
const boosters = useBoostersQuery()
const draft = ref<Draft | null>(null)
watch(
  [existing, () => props.id, () => themes.data.value],
  ([theme]) => {
    // Wait for the packs: an existing one to edit, or the colors a new one should avoid.
    if (!themes.data.value || (props.id && !theme)) return
    if (draft.value && (theme ? draft.value.key === theme.key : !props.id)) return
    draft.value = theme
      ? {
          key: theme.key,
          name: { ...theme.name } as Draft['name'],
          description: { en: '', ...(theme.description ?? {}) },
          category: theme.category,
          rules: JSON.parse(JSON.stringify(theme.rules)) as ThemeRule,
          seal: theme.seal,
          color: theme.color,
          isActive: theme.isActive,
        }
      : {
          key: '',
          name: { en: '' },
          description: { en: '' },
          category: 'custom',
          rules: { type: 'group', mode: 'all', rules: [] },
          seal: '招',
          color: firstFreePackColor(new Set(usedColors.value.keys())),
          isActive: true,
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
    seal: value.seal,
    color: value.color,
    isActive: value.isActive,
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
    <BackLink :to="{ name: 'admin-themes' }" :label="t('admin.themes.back')" />
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
            <AppSelect
              v-model="draft.category"
              :options="
                THEME_CATEGORIES.map((category) => ({
                  value: category,
                  label: t(`boosters.packs.categories.${category}`),
                }))
              "
            />
          </label>
          <label :class="ui.label">
            {{ t('admin.themes.seal') }}
            <span class="flex items-center gap-2">
              <input
                v-model.trim="draft.seal"
                required
                maxlength="2"
                :class="[ui.input, 'w-20 text-center text-lg']"
                data-testid="theme-seal"
              />
              <SealMark
                :glyph="draft.seal || '招'"
                class="size-9"
                :style="{ color: draft.color }"
              />
            </span>
          </label>
        </div>
        <div :class="ui.label">
          {{ t('admin.themes.color') }}
          <PackColorPicker v-model="draft.color" :used="usedColors" />
        </div>
        <div class="flex flex-wrap gap-4 text-sm">
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
        <div class="mx-auto w-36">
          <BoosterPack
            :label="draft.name.en || t('admin.themes.new')"
            :cards="boosters.data.value?.cardsPerBooster ?? 5"
            :color="draft.color"
            :seal="draft.seal || '招'"
            front
          />
        </div>
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
          <section class="flex flex-col gap-2" data-testid="theme-preview-series">
            <h3 class="text-sm font-semibold text-mist-300">
              {{
                t('admin.themes.previewSeries', {
                  count: n(preview.data.value.series.length, 'integer'),
                })
              }}
            </h3>
            <ul
              v-if="preview.data.value.series.length"
              class="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1 text-sm"
              tabindex="0"
              :aria-label="t('admin.themes.previewSeriesList')"
            >
              <li
                v-for="row in preview.data.value.series"
                :key="row.id"
                class="flex justify-between gap-2"
              >
                <span class="truncate">{{ row.title }}</span>
                <span class="text-mist-300 tabular-nums">{{ n(row.count, 'integer') }}</span>
              </li>
            </ul>
          </section>
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
