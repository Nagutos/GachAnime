import type { CompletedObjective, ProgressionUpdate } from '@gachanime/shared'
import { ref } from 'vue'
import { ApiError } from '@/api/client'

/** A completed mission or achievement, or a refused action (`errors.<code>`, with a link). */
export type Toast =
  | { id: number; objective: CompletedObjective }
  | {
      id: number
      error: { code: string; details: Record<string, unknown> }
      link?: { name: string; label: string }
    }

const DURATION_MS = 6000
let nextId = 1

/** Toasts shown by `ToastHost` (one app-wide list). */
export const toasts = ref<Toast[]>([])

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function push(toast: Toast): void {
  toasts.value = [...toasts.value, toast]
  setTimeout(() => dismissToast(toast.id), DURATION_MS)
}

function show(objective: CompletedObjective): void {
  push({ id: nextId++, objective })
}

/** Error toast for an action without a place to show its error (e.g. the wishlist heart). */
export function notifyError(error: unknown, link?: { name: string; label: string }): void {
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
  const details =
    error instanceof ApiError && error.details && typeof error.details === 'object'
      ? (error.details as Record<string, unknown>)
      : {}
  push({ id: nextId++, error: { code, details }, link })
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
