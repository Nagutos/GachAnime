/** Flattens nested message objects into dotted keys: `{ a: { b: 'x' } }` → `['a.b']`. */
export function flattenKeys(messages: unknown, prefix = ''): string[] {
  if (typeof messages !== 'object' || messages === null || Array.isArray(messages)) {
    return prefix ? [prefix] : []
  }
  return Object.entries(messages).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  )
}

export function compareLocaleKeys(reference: unknown, other: unknown) {
  const referenceKeys = new Set(flattenKeys(reference))
  const otherKeys = new Set(flattenKeys(other))
  return {
    missing: [...referenceKeys].filter((key) => !otherKeys.has(key)),
    extra: [...otherKeys].filter((key) => !referenceKeys.has(key)),
  }
}
