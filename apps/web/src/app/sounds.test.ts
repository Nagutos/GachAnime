import { describe, expect, it } from 'vitest'
import { playFlip, playReveal, playSwipe, playTear, setSoundEnabled, soundEnabled } from './sounds'

describe('sounds', () => {
  it('remembers the on/off choice in this browser', () => {
    setSoundEnabled(false)
    expect(soundEnabled.value).toBe(false)
    expect(localStorage.getItem('gachanime.sound')).toBe('off')
    setSoundEnabled(true)
    expect(localStorage.getItem('gachanime.sound')).toBe('on')
  })

  it('stays silent without Web Audio instead of failing', () => {
    expect(() => {
      playTear()
      playFlip()
      playSwipe()
      playReveal(5)
    }).not.toThrow()
  })
})
