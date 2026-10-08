/** Distinct hues that read well on the dark site, offered before a free color. */
export const PACK_COLOR_PRESETS = [
  '#ff5d8f',
  '#e2487d',
  '#ff8fc7',
  '#ff8a3d',
  '#ffd166',
  '#9be15d',
  '#2fc48d',
  '#36d1c4',
  '#3fb6e8',
  '#4f7dff',
  '#7c5cff',
  '#b06bff',
  '#c0c8d8',
  '#a0704a',
] as const

/** The first preset no other pack uses, for a new pack. */
export function firstFreePackColor(used: ReadonlySet<string>): string {
  return PACK_COLOR_PRESETS.find((color) => !used.has(color)) ?? PACK_COLOR_PRESETS[0]
}
