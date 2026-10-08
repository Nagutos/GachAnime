import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushDeferredToasts, notifyProgression, toasts } from './toasts'

const objective = (key: string) =>
  ({ kind: 'mission', key, name: { en: key }, rewardGems: 10 }) as never

describe('toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    toasts.value = []
  })
  afterEach(() => vi.useRealTimers())

  it('shows completed objectives, then dismisses them', () => {
    notifyProgression({ completed: [objective('a')] } as never)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(6000)
    expect(toasts.value).toHaveLength(0)
  })

  it('keeps deferred objectives until they are flushed', () => {
    notifyProgression({ completed: [objective('a'), objective('b')] } as never, { defer: true })
    expect(toasts.value).toHaveLength(0)
    flushDeferredToasts()
    expect(toasts.value.map((toast) => toast.objective)).toHaveLength(2)
    flushDeferredToasts()
    expect(toasts.value).toHaveLength(2)
  })
})
