import { describe, expect, it } from 'vitest'
import { packShape } from './pack-shape'

const points = (polygon: string) =>
  polygon
    .slice('polygon('.length, -1)
    .split(', ')
    .map((pair) => pair.split(' ').map((value) => Number.parseFloat(value)) as [number, number])

describe('packShape', () => {
  it('is deterministic', () => {
    expect(packShape()).toEqual(packShape())
  })

  it('gives the strip and the body the same tear line', () => {
    const shape = packShape({ teeth: 4, tearPoints: 6 })
    const strip = points(shape.strip)
    const body = points(shape.body)
    const stripTear = strip.slice(-7).reverse()
    expect(body.slice(0, 7)).toEqual(stripTear)
    for (const [, y] of stripTear) expect(Math.abs(y - shape.tearAt)).toBeLessThanOrEqual(0.9)
  })

  it('serrates the top and bottom edges', () => {
    const shape = packShape({ teeth: 4, toothDepth: 2 })
    const top = points(shape.strip).slice(0, 9)
    expect(top.map(([, y]) => y)).toEqual([2, 0, 2, 0, 2, 0, 2, 0, 2])
    const bottom = points(shape.body).slice(-9)
    expect(bottom.map(([, y]) => y)).toEqual([98, 100, 98, 100, 98, 100, 98, 100, 98])
  })
  it('has a whole outline made of the two serrated edges', () => {
    const shape = packShape({ teeth: 4, toothDepth: 2 })
    const full = points(shape.full)
    expect(full).toHaveLength(18)
    expect(full.slice(0, 9).map(([, y]) => y)).toEqual([2, 0, 2, 0, 2, 0, 2, 0, 2])
  })
})
