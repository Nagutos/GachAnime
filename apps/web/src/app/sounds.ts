import { ref } from 'vue'

/**
 * Sound effects of the booster opening, synthesized with the Web Audio API: no audio file to
 * ship or license. The context is created on the first sound (always after a click, as browsers
 * require). The on/off choice is a per-browser convenience kept in localStorage.
 */

const STORAGE_KEY = 'gachanime.sound'

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export const soundEnabled = ref(readEnabled())

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled.value = enabled
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Storage blocked (private window…): the choice lasts for this page only.
  }
}

let context: AudioContext | null = null
let master: GainNode | null = null

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!soundEnabled.value || typeof AudioContext === 'undefined') return null
  if (!context) {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = 0.5
    master.connect(context.destination)
  }
  if (context.state === 'suspended') void context.resume()
  return { ctx: context, out: master! }
}

interface ToneOptions {
  frequency: number
  /** Seconds from now. */
  at?: number
  duration: number
  type?: OscillatorType
  gain?: number
  /** Frequency reached at the end (pitch glide). */
  glideTo?: number
}

function tone(ctx: AudioContext, out: AudioNode, options: ToneOptions): void {
  const { frequency, at = 0, duration, type = 'sine', gain = 0.15, glideTo } = options
  const start = ctx.currentTime + at
  const oscillator = ctx.createOscillator()
  const envelope = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, start + duration)
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(envelope).connect(out)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.05)
}

let noiseBuffer: AudioBuffer | null = null

interface NoiseOptions {
  at?: number
  duration: number
  /** Band-pass center frequency, swept from `from` to `to`. */
  from: number
  to: number
  q?: number
  gain?: number
}

function noise(ctx: AudioContext, out: AudioNode, options: NoiseOptions): void {
  const { at = 0, duration, from, to, q = 1, gain = 0.2 } = options
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
  }
  const start = ctx.currentTime + at
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, start)
  filter.frequency.exponentialRampToValueAtTime(to, start + duration)
  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.03, duration / 4))
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(envelope).connect(out)
  source.start(start)
  source.stop(start + duration + 0.05)
}

/** The pack foil rips open. */
export function playTear(): void {
  const sound = audio()
  if (!sound) return
  const { ctx, out } = sound
  noise(ctx, out, { duration: 0.32, from: 2600, to: 700, q: 0.8, gain: 0.35 })
  noise(ctx, out, { at: 0.05, duration: 0.2, from: 5200, to: 1800, q: 2, gain: 0.12 })
  tone(ctx, out, { frequency: 140, duration: 0.25, glideTo: 70, gain: 0.12 })
}

/** A card turns over. */
export function playFlip(gain = 1): void {
  const sound = audio()
  if (!sound) return
  noise(sound.ctx, sound.out, { duration: 0.13, from: 1400, to: 3800, q: 1.4, gain: 0.16 * gain })
}

/** A card is swiped or thrown away. */
export function playSwipe(): void {
  const sound = audio()
  if (!sound) return
  noise(sound.ctx, sound.out, { duration: 0.22, from: 900, to: 2600, q: 0.9, gain: 0.14 })
}

/** The top rarity charges up before its flip: a rising whoosh and hum for `duration` seconds. */
export function playCharge(duration: number): void {
  const sound = audio()
  if (!sound || duration <= 0) return
  const { ctx, out } = sound
  noise(ctx, out, { duration, from: 300, to: 4200, q: 3, gain: 0.1 })
  tone(ctx, out, { frequency: 130.81, duration, glideTo: 523.25, type: 'sawtooth', gain: 0.025 })
  tone(ctx, out, { frequency: 196, duration, glideTo: 783.99, gain: 0.05 })
}

/** C major pentatonic, from C5: pleasant whatever notes are combined. */
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]

/** Chime of a revealed card: richer and longer for higher rarities (rank 1 = common). */
export function playReveal(rank: number): void {
  const sound = audio()
  if (!sound) return
  const { ctx, out } = sound
  const level = Math.max(1, Math.min(5, rank))
  const arpeggio = [0, 2, 3, 5, 7].slice(0, level)
  arpeggio.forEach((note, index) => {
    const frequency = NOTES[note]!
    tone(ctx, out, {
      frequency,
      at: index * 0.07,
      duration: 0.5 + level * 0.1,
      type: 'triangle',
      gain: 0.1,
    })
    tone(ctx, out, { frequency: frequency * 2, at: index * 0.07, duration: 0.3, gain: 0.03 })
  })
  if (level >= 4) {
    // Legendary and above: a low swell, then sparkles.
    tone(ctx, out, { frequency: 110, duration: 0.9, glideTo: 55, gain: 0.18 })
    if (level === 5) {
      // Mythic: a sustained bright chord under the arpeggio.
      for (const frequency of [261.63, 392, 659.25, 1046.5]) {
        tone(ctx, out, { frequency, at: 0.05, duration: 1.8, gain: 0.05 })
      }
    }
    const sparkles = level === 5 ? 14 : 4
    for (let index = 0; index < sparkles; index += 1) {
      const frequency = NOTES[5 + Math.floor(Math.random() * 5)]! * 2
      tone(ctx, out, { frequency, at: 0.3 + index * 0.08, duration: 0.25, gain: 0.035 })
    }
  }
}
