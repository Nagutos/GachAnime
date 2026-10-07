<script setup lang="ts">
import { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_TYPES } from '@gachanime/shared'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUploadImageMutation } from '@/api/admin'
import { ApiError } from '@/api/client'
import { useErrorMessage } from '../use-admin-error'
import { ui } from '../ui'

const props = defineProps<{ target: 'characters' | 'series'; id: number; label?: string }>()
const { t } = useI18n()
const upload = useUploadImageMutation()
const input = ref<HTMLInputElement | null>(null)
const localError = ref<unknown>(null)
const errorMessage = useErrorMessage(localError)

async function onFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  localError.value = null
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    localError.value = new ApiError('INVALID_IMAGE', 400, 'Too large')
    return
  }
  try {
    await upload.mutateAsync({ target: props.target, id: props.id, file })
  } catch (error) {
    localError.value = error
  } finally {
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <button
      type="button"
      :class="ui.button"
      :disabled="upload.isPending.value"
      @click="input?.click()"
    >
      {{
        upload.isPending.value ? t('admin.common.uploading') : (label ?? t('admin.common.upload'))
      }}
    </button>
    <input
      ref="input"
      type="file"
      class="hidden"
      :accept="IMAGE_UPLOAD_TYPES.join(',')"
      @change="onFile"
    />
    <p v-if="errorMessage" class="text-xs text-rarity-mythic">{{ errorMessage }}</p>
  </div>
</template>
