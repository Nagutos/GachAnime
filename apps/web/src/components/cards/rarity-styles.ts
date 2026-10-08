/**
 * Full Tailwind class names per rarity token (Tailwind only generates classes it can see).
 * Unknown tokens (rarities added by an admin) fall back to the common style.
 */
interface RarityStyle {
  /** Card frame. */
  frame: string
  /** Text color. */
  text: string
  /** Soft glow behind a card. */
  glow: string
  /** Solid background (badges, bars). */
  bg: string
}

const STYLES: Record<string, RarityStyle> = {
  common: {
    frame: 'border-rarity-common/70',
    text: 'text-rarity-common',
    glow: 'shadow-rarity-common/20',
    bg: 'bg-rarity-common',
  },
  rare: {
    frame: 'border-rarity-rare/80',
    text: 'text-rarity-rare',
    glow: 'shadow-rarity-rare/40',
    bg: 'bg-rarity-rare',
  },
  epic: {
    frame: 'border-rarity-epic',
    text: 'text-rarity-epic',
    glow: 'shadow-rarity-epic/60',
    bg: 'bg-rarity-epic',
  },
  legendary: {
    frame: 'border-rarity-legendary',
    text: 'text-rarity-legendary',
    glow: 'shadow-rarity-legendary/70',
    bg: 'bg-rarity-legendary',
  },
  mythic: {
    frame: 'border-rarity-mythic',
    text: 'text-rarity-mythic',
    glow: 'shadow-rarity-mythic/80',
    bg: 'bg-rarity-mythic',
  },
}

/** Color of a card frame (CSS variable read by `.card-frame`), any rarity key. */
export function frameStyle(key: string): Record<string, string> {
  return { '--frame': `var(--color-rarity-${key}, var(--color-rarity-common))` }
}

export function rarityStyle(key: string): RarityStyle {
  return STYLES[key] ?? STYLES.common!
}

/** Rarities that get a special reveal (shine, burst). */
export const SHINY_RARITIES = new Set(['legendary', 'mythic'])
export const HIGHLIGHT_RARITIES = new Set(['epic', 'legendary', 'mythic'])
