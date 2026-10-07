<script setup lang="ts">
import { rosterImportSchema, type RosterImportResult } from '@gachanime/shared'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useRosterImportMutation } from '@/api/admin'
import { useErrorMessage } from '../use-admin-error'
import { ui } from '../ui'
import AdminDialog from './AdminDialog.vue'

const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const router = useRouter()
const importRoster = useRosterImportMutation()
const text = ref('')
const localError = ref<string | null>(null)
const apiError = ref<unknown>(null)
const apiErrorMessage = useErrorMessage(apiError)
const result = ref<RosterImportResult | null>(null)

const example = JSON.stringify(
  {
    series: { slug: 'my-game', title: 'My Game', kind: 'game' },
    characters: [
      {
        key: 'hero',
        name: 'Hero',
        gender: 'female',
        rarity: 'legendary',
        imageUrl: 'https://example.com/hero.png',
      },
    ],
  },
  null,
  2,
)

watch(open, (isOpen) => {
  if (!isOpen) return
  text.value = ''
  localError.value = null
  apiError.value = null
  result.value = null
})

async function openSeries(id: number): Promise<void> {
  open.value = false
  await router.push({ name: 'admin-series-detail', params: { id } })
}

async function onFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) text.value = await file.text()
}

async function submit(): Promise<void> {
  localError.value = null
  apiError.value = null
  result.value = null
  let parsed: unknown
  try {
    parsed = JSON.parse(text.value)
  } catch {
    localError.value = t('admin.roster.invalidJson')
    return
  }
  const roster = rosterImportSchema.safeParse(parsed)
  if (!roster.success) {
    const issue = roster.error.issues[0]
    localError.value = `${t('admin.roster.invalidRoster')} ${issue ? `${issue.path.join('.')}: ${issue.message}` : ''}`
    return
  }
  try {
    result.value = await importRoster.mutateAsync(roster.data)
  } catch (caught) {
    apiError.value = caught
  }
}
</script>

<template>
  <AdminDialog
    v-model:open="open"
    :title="t('admin.roster.title')"
    :description="t('admin.roster.help')"
    wide
  >
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <label :class="ui.label">
        {{ t('admin.roster.file') }}
        <input type="file" accept="application/json,.json" class="text-sm" @change="onFile" />
      </label>
      <label :class="ui.label">
        {{ t('admin.roster.paste') }}
        <textarea
          v-model="text"
          rows="10"
          spellcheck="false"
          :class="[ui.input, 'font-mono text-xs']"
          :placeholder="example"
        />
      </label>
      <details class="text-sm text-mist-300">
        <summary class="cursor-pointer">{{ t('admin.roster.example') }}</summary>
        <pre class="mt-2 overflow-x-auto rounded-lg bg-night-950 p-3 text-xs">{{ example }}</pre>
      </details>
      <p v-if="localError" :class="ui.error" role="alert">{{ localError }}</p>
      <p v-if="apiErrorMessage" :class="ui.error" role="alert">{{ apiErrorMessage }}</p>
      <p
        v-if="result"
        class="rounded-lg bg-night-800 px-3 py-2 text-sm text-gold-400"
        role="status"
      >
        {{ t('admin.roster.result', { created: result.created, updated: result.updated }) }}
        <button type="button" class="ml-2 underline" @click="openSeries(result.seriesId)">
          {{ t('admin.seriesDetail.characters') }}
        </button>
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" :class="ui.button" @click="open = false">
          {{ t('admin.common.close') }}
        </button>
        <button
          type="submit"
          :class="ui.buttonPrimary"
          :disabled="!text || importRoster.isPending.value"
        >
          {{ t('admin.roster.submit') }}
        </button>
      </div>
    </form>
  </AdminDialog>
</template>
