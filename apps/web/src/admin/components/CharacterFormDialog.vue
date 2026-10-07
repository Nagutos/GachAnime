<script setup lang="ts">
import type { AdminCharacter, GenderClassValue } from '@gachanime/shared'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useCharacterDetailQuery,
  useCreateManualCharacterMutation,
  useUpdateCharacterMutation,
} from '@/api/admin'
import { useErrorMessage } from '../use-admin-error'
import { useRarities } from '../use-rarities'
import { ui } from '../ui'
import AdminDialog from '@/components/BaseDialog.vue'

/** Creates a manual character in `seriesId`, or edits `character` (manual) when given. */
const props = defineProps<{ seriesId?: number; character?: AdminCharacter | null }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const { rarities, nameOf } = useRarities()
const create = useCreateManualCharacterMutation()
const update = useUpdateCharacterMutation()
const detail = useCharacterDetailQuery(() => (open.value ? (props.character?.id ?? null) : null))
const error = ref<unknown>(null)
const errorMessage = useErrorMessage(error)
const genders: GenderClassValue[] = ['female', 'male', 'unclassified']

const form = reactive({
  nameFull: '',
  nameNative: '',
  description: '',
  imageUrl: '',
  gender: 'unclassified' as GenderClassValue,
  rarity: '',
})

const isEdit = computed(() => Boolean(props.character))
const pending = computed(() => create.isPending.value || update.isPending.value)

watch(
  [open, () => detail.data.value],
  ([isOpen, loaded]) => {
    if (!isOpen) return
    error.value = null
    const source = loaded ?? null
    form.nameFull = source?.nameFull ?? props.character?.nameFull ?? ''
    form.nameNative = source?.nameNative ?? ''
    form.description = source?.description ?? ''
    form.imageUrl = source && !source.imageUrl?.startsWith('/media/') ? (source.imageUrl ?? '') : ''
    form.gender = source?.genderClass ?? 'unclassified'
    form.rarity = source?.rarityKey ?? rarities.value[0]?.key ?? ''
  },
  { immediate: true },
)

async function submit(): Promise<void> {
  error.value = null
  const common = {
    nameFull: form.nameFull,
    nameNative: form.nameNative || null,
    description: form.description || null,
    ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
  }
  try {
    if (props.character) {
      await update.mutateAsync({
        id: props.character.id,
        ...common,
        rarity: form.rarity,
        genderOverride: form.gender,
      })
    } else if (props.seriesId) {
      await create.mutateAsync({
        seriesId: props.seriesId,
        ...common,
        gender: form.gender,
        rarity: form.rarity,
      })
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
    :title="
      isEdit
        ? t('admin.characterForm.titleEdit', { name: character?.nameFull ?? '' })
        : t('admin.characterForm.titleNew')
    "
  >
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <label :class="ui.label">
        {{ t('admin.characterForm.name') }}
        <input v-model="form.nameFull" required maxlength="200" :class="ui.input" />
      </label>
      <label :class="ui.label">
        {{ t('admin.characterForm.nameNative') }}
        <input v-model="form.nameNative" maxlength="200" :class="ui.input" />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label :class="ui.label">
          {{ t('admin.characterForm.gender') }}
          <select v-model="form.gender" :class="ui.select">
            <option v-for="gender in genders" :key="gender" :value="gender">
              {{ t(`admin.genders.${gender}`) }}
            </option>
          </select>
        </label>
        <label :class="ui.label">
          {{ t('admin.characterForm.rarity') }}
          <select v-model="form.rarity" :class="ui.select">
            <option v-for="rarity in rarities" :key="rarity.key" :value="rarity.key">
              {{ nameOf(rarity.key) }}
            </option>
          </select>
        </label>
      </div>
      <label :class="ui.label">
        {{ t('admin.characterForm.imageUrl') }}
        <input v-model="form.imageUrl" type="url" :class="ui.input" />
      </label>
      <label :class="ui.label">
        {{ t('admin.characterForm.description') }}
        <textarea v-model="form.description" rows="4" maxlength="10000" :class="ui.input" />
      </label>
      <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" :class="ui.button" @click="open = false">
          {{ t('admin.common.cancel') }}
        </button>
        <button type="submit" :class="ui.buttonPrimary" :disabled="pending">
          {{ isEdit ? t('admin.common.save') : t('admin.characterForm.create') }}
        </button>
      </div>
    </form>
  </AdminDialog>
</template>
