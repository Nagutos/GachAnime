<script setup lang="ts">
import { slugify, type AdminSeriesDetail } from '@gachanime/shared'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useCreateManualSeriesMutation, useUpdateSeriesMutation } from '@/api/admin'
import { useErrorMessage } from '../use-admin-error'
import { ui } from '../ui'
import AdminDialog from '@/components/BaseDialog.vue'

/** Creates a manual series, or edits `series` (manual) when given. */
const props = defineProps<{ series?: AdminSeriesDetail | null }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const router = useRouter()
const create = useCreateManualSeriesMutation()
const update = useUpdateSeriesMutation()
const error = ref<unknown>(null)
const errorMessage = useErrorMessage(error)
const slugTouched = ref(false)

const form = reactive({
  slug: '',
  title: '',
  titleEnglish: '',
  kind: 'game' as 'game' | 'other',
  description: '',
  coverUrl: '',
  genres: '',
})
const pending = computed(() => create.isPending.value || update.isPending.value)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    error.value = null
    slugTouched.value = Boolean(props.series)
    const series = props.series
    form.slug = series?.slug ?? ''
    form.title = series?.title ?? ''
    form.titleEnglish = series?.titleEnglish ?? ''
    form.kind = series?.kind === 'other' ? 'other' : 'game'
    form.description = series?.description ?? ''
    form.coverUrl = series && !series.coverUrl?.startsWith('/media/') ? (series.coverUrl ?? '') : ''
    form.genres = series?.genres.join(', ') ?? ''
  },
  { immediate: true },
)

watch(
  () => form.title,
  (title) => {
    if (!slugTouched.value) form.slug = slugify(title)
  },
)

async function submit(): Promise<void> {
  error.value = null
  const body = {
    slug: form.slug,
    title: form.title,
    titleEnglish: form.titleEnglish || null,
    kind: form.kind,
    description: form.description || null,
    coverUrl: form.coverUrl || null,
    genres: form.genres
      .split(',')
      .map((genre) => genre.trim())
      .filter(Boolean),
  }
  try {
    if (props.series) {
      await update.mutateAsync({ id: props.series.id, ...body })
    } else {
      const { id } = await create.mutateAsync(body)
      await router.push({ name: 'admin-series-detail', params: { id } })
    }
    open.value = false
  } catch (caught) {
    error.value = caught
  }
}
</script>

<template>
  <AdminDialog
    v-model:open="open"
    :title="series ? t('admin.seriesForm.editTitle') : t('admin.seriesForm.title')"
  >
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <label :class="ui.label">
        {{ t('admin.seriesForm.titleField') }}
        <input
          v-model="form.title"
          required
          maxlength="200"
          :class="ui.input"
          data-testid="series-title"
        />
      </label>
      <label :class="ui.label">
        {{ t('admin.seriesForm.slug') }}
        <input
          v-model="form.slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxlength="80"
          :class="ui.input"
          @input="slugTouched = true"
        />
        <span class="text-xs">{{ t('admin.seriesForm.slugHelp') }}</span>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label :class="ui.label">
          {{ t('admin.seriesForm.titleEnglish') }}
          <input v-model="form.titleEnglish" maxlength="200" :class="ui.input" />
        </label>
        <label :class="ui.label">
          {{ t('admin.seriesForm.kind') }}
          <select v-model="form.kind" :class="ui.select">
            <option value="game">{{ t('admin.kinds.game') }}</option>
            <option value="other">{{ t('admin.kinds.other') }}</option>
          </select>
        </label>
      </div>
      <label :class="ui.label">
        {{ t('admin.seriesForm.coverUrl') }}
        <input v-model="form.coverUrl" type="url" :class="ui.input" />
      </label>
      <label :class="ui.label">
        {{ t('admin.seriesForm.genres') }}
        <input v-model="form.genres" :class="ui.input" />
        <span class="text-xs">{{ t('admin.seriesForm.genresHelp') }}</span>
      </label>
      <label :class="ui.label">
        {{ t('admin.seriesForm.description') }}
        <textarea v-model="form.description" rows="4" maxlength="10000" :class="ui.input" />
      </label>
      <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" :class="ui.button" @click="open = false">
          {{ t('admin.common.cancel') }}
        </button>
        <button type="submit" :class="ui.buttonPrimary" :disabled="pending">
          {{ series ? t('admin.common.save') : t('admin.seriesForm.create') }}
        </button>
      </div>
    </form>
  </AdminDialog>
</template>
