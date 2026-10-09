/**
 * Translation key of each page's title (browser tab, WCAG 2.4.2). Pages of one area share
 * their area's name; the home page shows the app name only.
 */
export const PAGE_TITLE_KEYS: Record<string, string> = {
  boosters: 'nav.boosters',
  collection: 'nav.collection',
  'collection-series': 'nav.collection',
  'collection-wishlist': 'nav.collection',
  market: 'nav.market',
  trades: 'nav.trades',
  'trade-new': 'nav.trades',
  players: 'nav.players',
  profile: 'nav.players',
  missions: 'nav.missions',
  achievements: 'nav.achievements',
  gems: 'gems.title',
  wiki: 'nav.wiki',
  'wiki-series': 'nav.wiki',
  'wiki-character': 'nav.wiki',
  admin: 'admin.nav.dashboard',
  'admin-series': 'admin.nav.series',
  'admin-series-detail': 'admin.nav.series',
  'admin-characters': 'admin.nav.characters',
  'admin-imports': 'admin.nav.imports',
  'admin-boosters': 'admin.nav.boosters',
  'admin-rarities': 'admin.nav.rarities',
  'admin-settings': 'admin.nav.settings',
  'admin-themes': 'admin.nav.themes',
  'admin-theme-new': 'admin.nav.themes',
  'admin-theme-edit': 'admin.nav.themes',
  'admin-missions': 'admin.nav.missions',
  'admin-achievements': 'admin.nav.achievements',
  'admin-users': 'admin.nav.users',
  'admin-audit': 'admin.nav.audit',
  'not-found': 'notFound.title',
}

export function pageTitleKey(routeName: string | null | undefined): string | null {
  return (routeName && PAGE_TITLE_KEYS[routeName]) || null
}
