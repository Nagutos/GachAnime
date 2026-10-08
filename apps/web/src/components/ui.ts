/** Shared Tailwind class sets of the player area. */
export const playerUi = {
  page: 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16',
  title: 'font-display text-3xl font-bold',
  panel: 'rounded-2xl border border-night-700 bg-night-900/70 p-5',
  input:
    'rounded-lg border border-night-700 bg-night-950 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-300/50 focus:border-sakura-400 focus:outline-none',
  error:
    'rounded-lg border border-rarity-mythic/50 bg-rarity-mythic/10 px-3 py-2 text-sm text-rarity-mythic',
  cardGrid: 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6',
} as const
