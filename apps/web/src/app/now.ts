import { useIntervalFn } from '@vueuse/core'
import { ref, type Ref } from 'vue'

/** Current time, refreshed every second, corrected by the server clock offset. */
export function useServerNow(offsetMs: Ref<number>) {
  const now = ref(Date.now() + offsetMs.value)
  useIntervalFn(() => (now.value = Date.now() + offsetMs.value), 1000)
  return now
}

/** `mm:ss` (or `h:mm:ss`) until `target`, never negative. */
export function formatCountdown(targetMs: number, nowMs: number): string {
  const total = Math.max(0, Math.ceil((targetMs - nowMs) / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
