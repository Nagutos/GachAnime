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

function show(objective: CompletedObjective): void {
  const id = nextId++
  toasts.value = [...toasts.value, { id, objective }]
  setTimeout(() => dismissToast(id), DURATION_MS)
}

/** Objectives completed by a booster opening, shown once the opening scene closes. */
let deferred: CompletedObjective[] = []

/**
 * One toast per mission or achievement an action completed. `defer` keeps them until
 * `flushDeferredToasts()` (they would cover the booster opening scene otherwise).
 */
export function notifyProgression(
  update: ProgressionUpdate | undefined,
  options: { defer?: boolean } = {},
): void {
  const completed = update?.completed ?? []
  if (options.defer) deferred = [...deferred, ...completed]
  else completed.forEach(show)
}

export function flushDeferredToasts(): void {
  const pending = deferred
  deferred = []
  pending.forEach(show)
}
