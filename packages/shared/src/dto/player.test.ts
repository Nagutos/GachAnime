import { describe, expect, it } from 'vitest'
import { collectionQuerySchema, formatCollectionSort } from './player'

describe('collection query', () => {
  it('parses a multi-key sort and defaults to most recent', () => {
    expect(collectionQuerySchema.parse({}).sort).toEqual([{ key: 'recent', direction: 'desc' }])
    const sort = collectionQuerySchema.parse({ sort: 'rarity:desc,name' }).sort
    expect(sort).toEqual([
      { key: 'rarity', direction: 'desc' },
      { key: 'name', direction: 'asc' },
    ])
    expect(formatCollectionSort(sort)).toBe('rarity:desc,name:asc')
  })

  it('refuses unknown or repeated sort keys', () => {
    expect(collectionQuerySchema.safeParse({ sort: 'power:desc' }).success).toBe(false)
    expect(collectionQuerySchema.safeParse({ sort: 'name:asc,name:desc' }).success).toBe(false)
    expect(collectionQuerySchema.safeParse({ sort: 'name:up' }).success).toBe(false)
  })

  it('parses the ownership and boolean filters', () => {
    expect(collectionQuerySchema.parse({ ownership: 'missing', wishlist: 'true' })).toMatchObject({
      ownership: 'missing',
      wishlist: true,
    })
  })
})
