import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { flushDeferredToasts, notifyError, notifyProgression, toasts } from './toasts'

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
    expect(toasts.value.filter((toast) => 'objective' in toast)).toHaveLength(2)
    flushDeferredToasts()
    expect(toasts.value).toHaveLength(2)
  })

  it('shows a refused action with its translated code and an optional link', () => {
    notifyError(new ApiError('WISHLIST_FULL', 409, 'full', { max: 20 }), {
      name: 'collection-wishlist',
      label: 'wishlist.manage',
    })
    notifyError(new Error('boom'))
    expect(toasts.value).toMatchObject([
      {
        error: { code: 'WISHLIST_FULL', details: { max: 20 } },
        link: { name: 'collection-wishlist' },
      },
      { error: { code: 'INTERNAL_ERROR', details: {} } },
    ])
  })
})
