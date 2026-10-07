import type { CompletedObjective, ProgressionUpdate } from '@gachanime/shared'
import { ref } from 'vue'

export interface Toast {
  id: number
  objective: CompletedObjective
}

const DURATION_MS = 6000
let nextId = 1

/** Toasts shown by `ToastHost` (one app-wide list). */
export const toasts = ref<Toast[]>([])

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

/** One toast per mission or achievement an action completed. */
export function notifyProgression(update: ProgressionUpdate | undefined): void {
  for (const objective of update?.completed ?? []) {
    const id = nextId++
    toasts.value = [...toasts.value, { id, objective }]
    setTimeout(() => dismissToast(id), DURATION_MS)
  }
}
