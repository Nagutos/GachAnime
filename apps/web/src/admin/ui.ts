/** Shared Tailwind class sets of the admin area. */
export const ui = {
  card: 'rounded-2xl border border-night-700 bg-night-900/70 p-5',
  input:
    'w-full rounded-lg border border-night-700 bg-night-950 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-300/50 focus:border-sakura-400 focus:outline-none',
  select:
    'rounded-lg border border-night-700 bg-night-950 px-2 py-2 text-sm text-mist-100 focus:border-sakura-400 focus:outline-none',
  label: 'flex flex-col gap-1 text-sm text-mist-300',
  button:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm font-medium text-mist-100 transition hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-50',
  buttonPrimary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-sakura-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sakura-600 disabled:cursor-not-allowed disabled:opacity-50',
  buttonDanger:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-rarity-mythic/90 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rarity-mythic disabled:cursor-not-allowed disabled:opacity-50',
  table: 'w-full text-left text-sm',
  th: 'px-3 py-2 text-xs font-semibold tracking-wide text-mist-300 uppercase',
  td: 'px-3 py-2 align-middle',
  error:
    'rounded-lg border border-rarity-mythic/50 bg-rarity-mythic/10 px-3 py-2 text-sm text-rarity-mythic',
} as const

/** Full class names per rarity token (Tailwind only generates classes it can see). */
export const rarityClasses: Record<string, string> = {
  common: 'border-rarity-common/60 text-rarity-common',
  rare: 'border-rarity-rare/60 text-rarity-rare',
  epic: 'border-rarity-epic/60 text-rarity-epic',
  legendary: 'border-rarity-legendary/60 text-rarity-legendary',
  mythic: 'border-rarity-mythic/60 text-rarity-mythic',
}

export const rarityBarClasses: Record<string, string> = {
  common: 'bg-rarity-common',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
  mythic: 'bg-rarity-mythic',
}
