import { describe, expect, it } from 'vitest'
import { localizedTextSchema, resolveLocalizedText } from './localized-text'

describe('localizedTextSchema', () => {
  it('requires an English entry', () => {
    expect(localizedTextSchema.safeParse({ fr: 'Bonjour' }).success).toBe(false)
    expect(localizedTextSchema.safeParse({ en: 'Hello', fr: 'Bonjour' }).success).toBe(true)
  })

  it('rejects malformed locale codes and empty strings', () => {
    expect(localizedTextSchema.safeParse({ en: 'Hello', French: 'Bonjour' }).success).toBe(false)
    expect(localizedTextSchema.safeParse({ en: '  ' }).success).toBe(false)
  })
})

describe('resolveLocalizedText', () => {
  const text = { en: 'Hello', fr: 'Bonjour', 'pt-BR': 'Olá' }

  it('returns the requested locale', () => {
    expect(resolveLocalizedText(text, 'fr')).toBe('Bonjour')
    expect(resolveLocalizedText(text, 'pt-BR')).toBe('Olá')
  })

  it('falls back to the base language, then English', () => {
    expect(resolveLocalizedText({ en: 'Hello', fr: 'Bonjour' }, 'fr-CA')).toBe('Bonjour')
    expect(resolveLocalizedText(text, 'de')).toBe('Hello')
  })
})
