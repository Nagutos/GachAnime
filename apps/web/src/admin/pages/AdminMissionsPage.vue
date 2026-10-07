<script setup lang="ts">
import { GAME_EVENT_TYPES, resolveLocalizedText, type AdminMission } from '@gachanime/shared'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminMissionsQuery, useSaveMissionMutation } from '@/api/admin'
import { useErrorMessage } from '@/app/errors'
import BaseDialog from '@/components/BaseDialog.vue'
import ObjectiveTextFields from '../components/ObjectiveTextFields.vue'
import { cleanLocalized } from '../text'
import { ui } from '../ui'

interface Draft {
  id: number | null
  key: string
  name: { en: string; fr?: string }
  description: { en: string; fr?: string }
  kind: 'daily' | 'once'
  eventType: AdminMission['eventType']
  /** `field=value` pairs, one per line. */
  filter: string
  target: number
  rewardGems: number
  isActive: boolean
  sortOrder: number
}

const { t, n, locale } = useI18n()
const query = useAdminMissionsQuery()
const save = useSaveMissionMutation()
const errorMessage = useErrorMessage(save.error)
const open = ref(false)
const draft = ref<Draft | null>(null)
const filterError = ref(false)

function edit(mission: AdminMission | null): void {
  save.reset()
  filterError.value = false
  draft.value = mission
    ? {
        id: mission.id,
        key: mission.key,
        name: { ...mission.name } as Draft['name'],
        description: { en: '', ...(mission.description ?? {}) },
        kind: mission.kind,
        eventType: mission.eventType,
        filter: Object.entries(mission.filter ?? {})
          .map(([key, value]) => `${key}=${value}`)
          .join('\n'),
        target: mission.target,
        rewardGems: mission.rewardGems,
        isActive: mission.isActive,
        sortOrder: mission.sortOrder,
      }
    : {
        id: null,
        key: '',
        name: { en: '' },
        description: { en: '' },
        kind: 'daily',
        eventType: 'booster_opened',
        filter: '',
        target: 1,
        rewardGems: 20,
        isActive: true,
        sortOrder: 0,
      }
  open.value = true
}

/** `tier=divine` lines → `{ tier: 'divine' }`; numbers and booleans are typed. */
function parseFilter(text: string): Record<string, string | number | boolean> | null {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  const filter: Record<string, string | number | boolean> = {}
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    const raw = rest.join('=').trim()
    if (!key?.trim() || !raw) throw new Error('invalid filter')
    filter[key.trim()] =
      raw === 'true' ? true : raw === 'false' ? false : /^-?\d+$/.test(raw) ? Number(raw) : raw
  }
  return filter
}

async function submit(): Promise<void> {
  const value = draft.value
  if (!value) return
  let filter: ReturnType<typeof parseFilter>
  try {
    filter = parseFilter(value.filter)
    filterError.value = false
  } catch {
    filterError.value = true
    return
  }
  const description = cleanLocalized(value.description)
  const fields = {
    name: cleanLocalized(value.name),
    description: description.en ? description : null,
    kind: value.kind,
    eventType: value.eventType,
    filter,
    target: value.target,
    rewardGems: value.rewardGems,
    isActive: value.isActive,
    sortOrder: value.sortOrder,
  }
  await save.mutateAsync(
    value.id === null
      ? { create: { ...fields, key: value.key } }
      : { id: value.id, changes: fields },
  )
  open.value = false
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-3xl font-bold">{{ t('admin.missions.title') }}</h1>
        <p class="text-mist-300">{{ t('admin.missions.help') }}</p>
      </div>
      <button type="button" :class="ui.buttonPrimary" @click="edit(null)">
        {{ t('admin.missions.new') }}
      </button>
    </div>
    <p v-if="query.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <div v-else class="overflow-x-auto rounded-2xl border border-night-700">
      <table :class="ui.table">
        <thead class="bg-night-900">
          <tr>
            <th :class="ui.th">{{ t('admin.objectives.name') }}</th>
            <th :class="ui.th">{{ t('admin.missions.kind') }}</th>
            <th :class="ui.th">{{ t('admin.missions.event') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.objectives.target') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.objectives.reward') }}</th>
            <th :class="ui.th">{{ t('admin.common.active') }}</th>
            <th :class="ui.th">
              <span class="sr-only">{{ t('admin.common.edit') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="mission in query.data.value?.missions ?? []"
            :key="mission.id"
            class="border-t border-night-800"
            :class="{ 'opacity-50': !mission.isActive }"
          >
            <td :class="ui.td">
              <p class="font-semibold">{{ resolveLocalizedText(mission.name, locale) }}</p>
              <p class="text-xs text-mist-300">{{ mission.key }}</p>
            </td>
            <td :class="ui.td">{{ t(`admin.missions.kinds.${mission.kind}`) }}</td>
            <td :class="ui.td">
              <code class="text-xs">{{ mission.eventType }}</code>
              <code v-if="mission.filter" class="block text-xs text-mist-300">
                {{ JSON.stringify(mission.filter) }}
              </code>
            </td>
            <td :class="[ui.td, 'text-right tabular-nums']">{{ n(mission.target, 'integer') }}</td>
            <td :class="[ui.td, 'text-right tabular-nums']">
              {{ n(mission.rewardGems, 'integer') }}
            </td>
            <td :class="ui.td">
              {{ mission.isActive ? t('admin.common.active') : t('admin.common.inactive') }}
            </td>
            <td :class="ui.td">
              <button type="button" :class="ui.button" @click="edit(mission)">
                {{ t('admin.common.edit') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseDialog
      v-model:open="open"
      :title="draft?.id ? t('admin.missions.edit') : t('admin.missions.new')"
      wide
    >
      <form v-if="draft" class="flex flex-col gap-4" @submit.prevent="submit">
        <label v-if="draft.id === null" :class="ui.label">
          {{ t('admin.objectives.key') }}
          <input
            v-model.trim="draft.key"
            required
            pattern="[a-z][a-z0-9_]{1,63}"
            :class="ui.input"
          />
        </label>
        <ObjectiveTextFields v-model:name="draft.name" v-model:description="draft.description" />
        <div class="grid gap-3 sm:grid-cols-3">
          <label :class="ui.label">
            {{ t('admin.missions.kind') }}
            <select v-model="draft.kind" :class="ui.select">
              <option value="daily">{{ t('admin.missions.kinds.daily') }}</option>
              <option value="once">{{ t('admin.missions.kinds.once') }}</option>
            </select>
          </label>
          <label :class="ui.label">
            {{ t('admin.missions.event') }}
            <select v-model="draft.eventType" :class="ui.select">
              <option v-for="type in GAME_EVENT_TYPES" :key="type" :value="type">{{ type }}</option>
            </select>
          </label>
          <label :class="ui.label">
            {{ t('admin.objectives.target') }}
            <input v-model.number="draft.target" type="number" min="1" :class="ui.input" />
          </label>
          <label :class="ui.label">
            {{ t('admin.objectives.reward') }}
            <input v-model.number="draft.rewardGems" type="number" min="0" :class="ui.input" />
          </label>
          <label :class="ui.label">
            {{ t('admin.boosters.sortOrder') }}
            <input v-model.number="draft.sortOrder" type="number" min="0" :class="ui.input" />
          </label>
          <label class="flex items-center gap-2 self-end pb-2 text-sm">
            <input v-model="draft.isActive" type="checkbox" class="accent-sakura-500" />
            {{ t('admin.common.active') }}
          </label>
        </div>
        <label :class="ui.label">
          {{ t('admin.missions.filter') }}
          <textarea v-model="draft.filter" rows="2" :class="[ui.input, 'font-mono']" />
          <span class="text-xs">{{ t('admin.missions.filterHelp') }}</span>
        </label>
        <p v-if="filterError" :class="ui.error">{{ t('admin.missions.filterInvalid') }}</p>
        <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
        <div class="flex justify-end gap-3">
          <button type="button" :class="ui.button" @click="open = false">
            {{ t('admin.common.cancel') }}
          </button>
          <button type="submit" :class="ui.buttonPrimary" :disabled="save.isPending.value">
            {{ t('admin.common.save') }}
          </button>
        </div>
      </form>
    </BaseDialog>
  </div>
</template>
