<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ui } from '../ui'
import AdminDialog from '@/components/BaseDialog.vue'

defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  pending?: boolean
}>()
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
</script>

<template>
  <AdminDialog v-model:open="open" :title="title" :description="description">
    <slot />
    <div class="flex justify-end gap-2">
      <button type="button" :class="ui.button" @click="open = false">
        {{ t('admin.common.cancel') }}
      </button>
      <button
        type="button"
        :class="danger ? ui.buttonDanger : ui.buttonPrimary"
        :disabled="pending"
        data-testid="confirm-button"
        @click="emit('confirm')"
      >
        {{ confirmLabel ?? t('admin.common.confirm') }}
      </button>
    </div>
  </AdminDialog>
</template>
