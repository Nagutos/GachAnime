<script setup lang="ts">
import { THEME_RULE_TYPES, type ThemeRule, type ThemeRuleOptions } from '@gachanime/shared'
import { useI18n } from 'vue-i18n'
import { ui } from '../ui'

defineOptions({ name: 'RuleEditor' })

const MAX_DEPTH = 3
const props = withDefaults(
  defineProps<{ options: ThemeRuleOptions; depth?: number; removable?: boolean }>(),
  { depth: 0, removable: false },
)
const rule = defineModel<ThemeRule>({ required: true })
const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()

type RuleType = ThemeRule['type']

function blank(type: RuleType): ThemeRule {
  switch (type) {
    case 'group':
      return { type: 'group', mode: 'any', rules: [] }
    case 'tag':
      return { type: 'tag', tag: props.options.tags[0]?.name ?? 'Shounen', minRank: 60 }
    case 'genre':
      return { type: 'genre', genre: props.options.genres[0] ?? 'Action' }
    case 'gender':
      return { type: 'gender', gender: 'female' }
    case 'series_kind':
      return { type: 'series_kind', kind: 'anime' }
    case 'media_format':
      return { type: 'media_format', format: props.options.formats[0] ?? 'TV' }
    case 'series':
      return {
        type: 'series',
        seriesIds: props.options.series[0] ? [props.options.series[0].id] : [],
      }
  }
}

function addChild(type: RuleType): void {
  if (rule.value.type !== 'group') return
  rule.value = { ...rule.value, rules: [...rule.value.rules, blank(type)] }
}

function setChild(index: number, child: ThemeRule): void {
  if (rule.value.type !== 'group') return
  rule.value = { ...rule.value, rules: rule.value.rules.map((r, i) => (i === index ? child : r)) }
}

function removeChild(index: number): void {
  if (rule.value.type !== 'group') return
  rule.value = { ...rule.value, rules: rule.value.rules.filter((_, i) => i !== index) }
}

function patch(changes: Partial<ThemeRule>): void {
  rule.value = { ...rule.value, ...changes } as ThemeRule
}

const childTypes = (depth: number) =>
  THEME_RULE_TYPES.filter((type) => type !== 'group' || depth < MAX_DEPTH)
</script>

<template>
  <div
    v-if="rule.type === 'group'"
    class="flex flex-col gap-2 rounded-xl border border-night-700 p-3"
    :class="depth > 0 ? 'bg-night-950/40' : 'bg-night-950/20'"
    :data-testid="`rule-group-${depth}`"
  >
    <div class="flex flex-wrap items-center gap-2">
      <select
        :value="rule.mode"
        :class="ui.select"
        :aria-label="t('admin.themes.rules.mode')"
        @change="patch({ mode: ($event.target as HTMLSelectElement).value as 'all' | 'any' })"
      >
        <option value="all">{{ t('admin.themes.rules.all') }}</option>
        <option value="any">{{ t('admin.themes.rules.any') }}</option>
      </select>
      <span class="flex-1" />
      <button v-if="removable" type="button" :class="ui.button" @click="emit('remove')">
        {{ t('admin.common.delete') }}
      </button>
    </div>
    <p v-if="rule.rules.length === 0" class="text-sm text-mist-300">
      {{
        rule.mode === 'all' ? t('admin.themes.rules.emptyAll') : t('admin.themes.rules.emptyAny')
      }}
    </p>
    <RuleEditor
      v-for="(child, index) in rule.rules"
      :key="index"
      :model-value="child"
      :options="options"
      :depth="depth + 1"
      removable
      @update:model-value="(value: ThemeRule) => setChild(index, value)"
      @remove="removeChild(index)"
    />
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-mist-300">{{ t('admin.themes.rules.add') }}</span>
      <button
        v-for="type in childTypes(depth)"
        :key="type"
        type="button"
        class="rounded-lg border border-dashed border-night-500 px-2 py-1 text-xs text-mist-300 hover:text-mist-100"
        :data-testid="`add-rule-${type}`"
        @click="addChild(type)"
      >
        {{ t(`admin.themes.rules.types.${type}`) }}
      </button>
    </div>
  </div>

  <div v-else class="flex flex-wrap items-center gap-2 rounded-lg bg-night-800/60 p-2">
    <span class="text-sm font-semibold">{{ t(`admin.themes.rules.types.${rule.type}`) }}</span>
    <template v-if="rule.type === 'tag'">
      <input
        :value="rule.tag"
        list="theme-tags"
        :class="[ui.input, 'w-48']"
        :aria-label="t('admin.themes.rules.types.tag')"
        @change="patch({ tag: ($event.target as HTMLInputElement).value })"
      />
      <datalist id="theme-tags">
        <option v-for="tag in options.tags" :key="tag.name" :value="tag.name" />
      </datalist>
      <label class="flex items-center gap-1 text-sm text-mist-300">
        {{ t('admin.themes.rules.minRank') }}
        <input
          :value="rule.minRank"
          type="number"
          min="0"
          max="100"
          :class="[ui.input, 'w-20']"
          @change="patch({ minRank: Number(($event.target as HTMLInputElement).value) })"
        />
      </label>
    </template>
    <select
      v-else-if="rule.type === 'genre'"
      :value="rule.genre"
      :class="ui.select"
      :aria-label="t('admin.themes.rules.types.genre')"
      @change="patch({ genre: ($event.target as HTMLSelectElement).value })"
    >
      <option v-for="genre in options.genres" :key="genre" :value="genre">{{ genre }}</option>
    </select>
    <select
      v-else-if="rule.type === 'gender'"
      :value="rule.gender"
      :class="ui.select"
      :aria-label="t('admin.themes.rules.types.gender')"
      @change="patch({ gender: ($event.target as HTMLSelectElement).value as 'female' | 'male' })"
    >
      <option value="female">{{ t('admin.genders.female') }}</option>
      <option value="male">{{ t('admin.genders.male') }}</option>
      <option value="unclassified">{{ t('admin.genders.unclassified') }}</option>
    </select>
    <select
      v-else-if="rule.type === 'series_kind'"
      :value="rule.kind"
      :class="ui.select"
      :aria-label="t('admin.themes.rules.types.series_kind')"
      @change="
        patch({ kind: ($event.target as HTMLSelectElement).value as 'anime' | 'game' | 'other' })
      "
    >
      <option value="anime">{{ t('admin.kinds.anime') }}</option>
      <option value="game">{{ t('admin.kinds.game') }}</option>
      <option value="other">{{ t('admin.kinds.other') }}</option>
    </select>
    <select
      v-else-if="rule.type === 'media_format'"
      :value="rule.format"
      :class="ui.select"
      :aria-label="t('admin.themes.rules.types.media_format')"
      @change="patch({ format: ($event.target as HTMLSelectElement).value })"
    >
      <option v-for="format in options.formats" :key="format" :value="format">{{ format }}</option>
    </select>
    <select
      v-else-if="rule.type === 'series'"
      :value="rule.seriesIds.map(String)"
      multiple
      size="5"
      :class="[ui.select, 'min-w-64']"
      :aria-label="t('admin.themes.rules.types.series')"
      @change="
        patch({
          seriesIds: Array.from(($event.target as HTMLSelectElement).selectedOptions).map((o) =>
            Number(o.value),
          ),
        })
      "
    >
      <option v-for="item in options.series" :key="item.id" :value="String(item.id)">
        {{ item.title }}
      </option>
    </select>
    <span class="flex-1" />
    <button type="button" :class="ui.button" @click="emit('remove')">
      {{ t('admin.common.delete') }}
    </button>
  </div>
</template>
