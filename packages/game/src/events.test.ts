import { describe, expect, it } from 'vitest'
import { counterIncrements, eventAmount, eventSubject, matchesFilter } from './events'
import { counterKeysFor, metricsAffectedBy } from './metrics'

const ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic']

describe('events', () => {
  it('advances missions by count or quantity', () => {
    expect(eventAmount({ type: 'booster_opened', tier: 'free', quantity: 5 })).toBe(5)
    expect(eventAmount({ type: 'card_recycled', rarity: 'rare', count: 3 })).toBe(3)
    expect(eventAmount({ type: 'account_created' })).toBe(1)
  })

  it('dedups wishlist additions per character', () => {
    expect(eventSubject({ type: 'wishlist_added', characterId: 4 })).toBe('character:4')
    expect(eventSubject({ type: 'feedback_submitted' })).toBeNull()
  })

  it('matches mission filters on event fields', () => {
    const divine = { type: 'booster_opened', tier: 'divine', quantity: 1 } as const
    expect(matchesFilter(divine, null)).toBe(true)
    expect(matchesFilter(divine, { tier: 'divine' })).toBe(true)
    expect(matchesFilter(divine, { tier: 'free' })).toBe(false)
  })

  it('updates lifetime counters', () => {
    expect(counterIncrements({ type: 'booster_opened', tier: 'epic', quantity: 10 })).toEqual({
      boosters_opened: 10,
      'boosters_opened:epic': 10,
    })
    expect(
      counterIncrements({ type: 'card_obtained', rarity: 'epic', count: 2, newCount: 1 }),
    ).toEqual({ 'cards_obtained:epic': 2 })
    expect(counterIncrements({ type: 'wishlist_added', characterId: 1 })).toEqual({})
  })
})

describe('metrics', () => {
  it('sums the counters of a rarity and the higher ones', () => {
    expect(counterKeysFor('cards_obtained', { minRarity: 'legendary' }, ORDER)).toEqual([
      'cards_obtained:legendary',
      'cards_obtained:mythic',
    ])
    expect(counterKeysFor('cards_obtained', {}, ORDER)).toHaveLength(5)
    expect(counterKeysFor('boosters_opened', { tier: 'divine' }, ORDER)).toEqual([
      'boosters_opened:divine',
    ])
    expect(counterKeysFor('series_completed', {}, ORDER)).toEqual([])
  })

  it('knows which metrics an event affects', () => {
    expect(metricsAffectedBy(['card_obtained'])).toEqual(
      new Set([
        'cards_obtained',
        'distinct_characters_owned',
        'series_completed',
        'catalog_completion',
      ]),
    )
    expect(metricsAffectedBy(['wishlist_added']).size).toBe(0)
  })
})
