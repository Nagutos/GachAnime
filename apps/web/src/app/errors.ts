import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '@/api/client'

/** Translated message of the last API error (`errors.<code>`), or null. */
export function useErrorMessage(error: Ref<unknown>) {
  const { t } = useI18n()
  return computed(() => {
    const value = error.value
    if (!value) return null
    return t(`errors.${value instanceof ApiError ? value.code : 'INTERNAL_ERROR'}`)
  })
}
