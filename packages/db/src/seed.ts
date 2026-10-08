import { defaultSettingValue, settingsSchemas, type SettingKey } from '@gachanime/shared'
import type { ThemeRule } from '@gachanime/shared'
import type { Executor } from './client'
import {
  achievements,
  boosterTiers,
  catalogState,
  missions,
  rarities,
  settings,
  themes,
} from './schema'

/** Default rarities (GAME_DESIGN §1). Thresholds are absolute AniList favourites (ADR-015). */
export const DEFAULT_RARITIES = [
  {
    key: 'common',
    recycleValue: 1,
    marketMinPrice: 1,
    marketMaxPrice: 100,
    sortOrder: 1,
    name: { en: 'Common', fr: 'Commune' },
    colorToken: 'common',
    favouritesThreshold: 0,
  },
  {
    key: 'rare',
    recycleValue: 2,
    marketMinPrice: 2,
    marketMaxPrice: 200,
    sortOrder: 2,
    name: { en: 'Rare', fr: 'Rare' },
    colorToken: 'rare',
    favouritesThreshold: 500,
  },
  {
    key: 'epic',
    recycleValue: 10,
    marketMinPrice: 10,
    marketMaxPrice: 1000,
    sortOrder: 3,
    name: { en: 'Epic', fr: 'Épique' },
    colorToken: 'epic',
    favouritesThreshold: 3_000,
  },
  {
    key: 'legendary',
    recycleValue: 50,
    marketMinPrice: 50,
    marketMaxPrice: 5000,
    sortOrder: 4,
    name: { en: 'Legendary', fr: 'Légendaire' },
    colorToken: 'legendary',
    favouritesThreshold: 15_000,
  },
  {
    key: 'mythic',
    recycleValue: 250,
    marketMinPrice: 250,
    marketMaxPrice: 20000,
    sortOrder: 5,
    name: { en: 'Mythic', fr: 'Mythique' },
    colorToken: 'mythic',
    favouritesThreshold: 50_000,
  },
] as const

/**
 * Default booster tiers. Free tier weights come from the "at least one per booster" targets
 * (GAME_DESIGN §2: Rare 94.1 %, Epic 17.6 %, Legendary 2 %, Mythic 0.33 %); paid tiers follow the
 * GAME_DESIGN §2 table.
 */
export const DEFAULT_BOOSTER_TIERS = [
  {
    key: 'free',
    name: { en: 'Free booster', fr: 'Booster gratuit' },
    description: {
      en: 'Five cards from the whole catalog. A new one every few minutes.',
      fr: 'Cinq cartes de tout le catalogue. Un nouveau toutes les quelques minutes.',
    },
    weights: { common: 525_097, rare: 432_233, epic: 37_977, legendary: 4_032, mythic: 661 },
    priceGems: null,
    sortOrder: 0,
    artToken: 'free',
  },
  {
    key: 'epic',
    name: { en: 'Epic booster', fr: 'Booster épique' },
    description: {
      en: 'Many more Epic cards, and better odds for the rarest ones.',
      fr: 'Bien plus de cartes épiques, et de meilleures chances pour les plus rares.',
    },
    weights: { common: 400_000, rare: 400_000, epic: 180_000, legendary: 16_000, mythic: 4_000 },
    priceGems: 150,
    sortOrder: 1,
    artToken: 'epic',
  },
  {
    key: 'legendary',
    name: { en: 'Legendary booster', fr: 'Booster légendaire' },
    description: {
      en: 'Legendary cards become common sights.',
      fr: 'Les cartes légendaires deviennent monnaie courante.',
    },
    weights: { common: 300_000, rare: 400_000, epic: 200_000, legendary: 85_000, mythic: 15_000 },
    priceGems: 500,
    sortOrder: 2,
    artToken: 'legendary',
  },
  {
    key: 'mythic',
    name: { en: 'Mythic booster', fr: 'Booster mythique' },
    description: {
      en: 'The best odds of finding a Mythic card.',
      fr: 'Les meilleures chances de trouver une carte mythique.',
    },
    weights: { common: 200_000, rare: 400_000, epic: 250_000, legendary: 100_000, mythic: 50_000 },
    priceGems: 1_500,
    sortOrder: 3,
    artToken: 'mythic',
  },
  {
    key: 'divine',
    name: { en: 'Divine booster', fr: 'Booster divin' },
    description: {
      en: 'Only Epic cards or better.',
      fr: 'Uniquement des cartes épiques ou mieux.',
    },
    weights: { common: 0, rare: 0, epic: 550_000, legendary: 300_000, mythic: 150_000 },
    priceGems: 5_000,
    sortOrder: 4,
    artToken: 'divine',
  },
] as const

/** Default missions (GAME_DESIGN §8). Rewards are gems only (decision). */
export const DEFAULT_MISSIONS = [
  {
    key: 'daily_open_booster',
    name: { en: 'Open your first booster', fr: 'Ouvre ton premier booster' },
    kind: 'daily',
    eventType: 'booster_opened',
    target: 1,
    rewardGems: 20,
    sortOrder: 1,
  },
  {
    key: 'daily_recycle',
    name: { en: 'Recycle a duplicate', fr: 'Recycle un doublon' },
    kind: 'daily',
    eventType: 'card_recycled',
    target: 1,
    rewardGems: 20,
    sortOrder: 2,
  },
  {
    key: 'daily_wishlist',
    name: { en: 'Add 3 characters to your wishlist', fr: 'Ajoute 3 persos à ta wishlist' },
    kind: 'daily',
    eventType: 'wishlist_added',
    target: 3,
    rewardGems: 20,
    sortOrder: 3,
  },
  {
    key: 'daily_wiki',
    name: { en: 'Open a wiki entry', fr: 'Ouvre une fiche du wiki' },
    kind: 'daily',
    eventType: 'wiki_entry_viewed',
    target: 1,
    rewardGems: 20,
    sortOrder: 4,
  },
  {
    key: 'welcome',
    name: { en: 'Create your account', fr: 'Crée ton compte' },
    kind: 'once',
    eventType: 'account_created',
    target: 1,
    rewardGems: 30,
    sortOrder: 0,
  },
] as const

type AchievementSeed = {
  key: string
  name: { en: string; fr: string }
  description: { en: string; fr: string }
  metric: string
  params?: Record<string, string>
  target: number
  rewardGems: number
  iconToken: string
  isActive?: boolean
}

const open = (key: string, target: number, rewardGems: number, en: string, fr: string) => ({
  key,
  name: { en, fr },
  description: { en: `Open ${target} boosters.`, fr: `Ouvre ${target} boosters.` },
  metric: 'boosters_opened',
  target,
  rewardGems,
  iconToken: 'booster',
})
const own = (key: string, target: number, rewardGems: number, en: string, fr: string) => ({
  key,
  name: { en, fr },
  description: {
    en: `Own ${target} different characters.`,
    fr: `Possède ${target} personnages différents.`,
  },
  metric: 'distinct_characters_owned',
  target,
  rewardGems,
  iconToken: 'collection',
})
const catalog = (key: string, target: number, rewardGems: number, en: string, fr: string) => ({
  key,
  name: { en, fr },
  description: {
    en: `Own ${target} % of the active catalog.`,
    fr: `Possède ${target} % du catalogue actif.`,
  },
  metric: 'catalog_completion',
  target,
  rewardGems,
  iconToken: 'globe',
})
const first = (
  rarity: string,
  rewardGems: number,
  en: string,
  fr: string,
  enR: string,
  frR: string,
) => ({
  key: `first_${rarity}`,
  name: { en, fr },
  description: { en: `Obtain a ${enR} card or better.`, fr: `Obtiens une carte ${frR} ou mieux.` },
  metric: 'cards_obtained',
  params: { minRarity: rarity },
  target: 1,
  rewardGems,
  iconToken: rarity,
})
const series = (key: string, target: number, rewardGems: number, en: string, fr: string) => ({
  key,
  name: { en, fr },
  description: { en: `Complete ${target} series.`, fr: `Complète ${target} séries.` },
  metric: 'series_completed',
  target,
  rewardGems,
  iconToken: 'album',
})
const sell = (key: string, target: number, rewardGems: number, en: string, fr: string) => ({
  key,
  name: { en, fr },
  description: {
    en: `Sell ${target} cards on the market.`,
    fr: `Vends ${target} cartes au marché.`,
  },
  metric: 'cards_sold',
  target,
  rewardGems,
  iconToken: 'market',
})
const trade = (key: string, target: number, rewardGems: number, en: string, fr: string) => ({
  key,
  name: { en, fr },
  description: { en: `Complete ${target} trades.`, fr: `Termine ${target} échanges.` },
  metric: 'trades_completed',
  target,
  rewardGems,
  iconToken: 'trade',
})

/** Default achievements (GAME_DESIGN §8). */
export const DEFAULT_ACHIEVEMENTS: AchievementSeed[] = [
  open('open_10', 10, 10, 'First Steps', 'Premiers pas'),
  open('open_100', 100, 50, 'Regular', 'Habitué'),
  open('open_1000', 1000, 300, 'Hooked', 'Accro'),
  open('open_10000', 10000, 2000, 'Go Touch Grass', 'Va donc jouer dehors'),
  own('own_50', 50, 20, 'Collector', 'Collectionneur'),
  own('own_250', 250, 75, 'Archivist', 'Archiviste'),
  own('own_1000', 1000, 300, 'Encyclopedist', 'Encyclopédiste'),
  own('own_2000', 2000, 800, 'Librarian', 'Bibliothécaire'),
  catalog('catalog_10', 10, 300, 'Explorer', 'Explorateur'),
  catalog('catalog_25', 25, 1000, 'Globetrotter', 'Grand voyageur'),
  catalog('catalog_50', 50, 3000, 'Half the World', 'La moitié du monde'),
  catalog('catalog_75', 75, 6000, 'Almost Everything', 'Presque tout'),
  first('epic', 20, 'Epic!', 'Épique !', 'Epic', 'épique'),
  first('legendary', 75, 'Legendary!', 'Légendaire !', 'Legendary', 'légendaire'),
  first('mythic', 200, 'Mythic!', 'Mythique !', 'Mythic', 'mythique'),
  {
    key: 'own_10_mythics',
    name: { en: 'Pantheon', fr: 'Panthéon' },
    description: {
      en: 'Own 10 different Mythic characters.',
      fr: 'Possède 10 personnages mythiques différents.',
    },
    metric: 'distinct_characters_owned',
    params: { rarity: 'mythic' },
    target: 10,
    rewardGems: 500,
    iconToken: 'mythic',
  },
  {
    key: 'open_divine',
    name: { en: 'Touched by the Gods', fr: 'Touché par les dieux' },
    description: { en: 'Open a Divine booster.', fr: 'Ouvre un booster divin.' },
    metric: 'boosters_opened',
    params: { tier: 'divine' },
    target: 1,
    rewardGems: 500,
    iconToken: 'divine',
  },
  series('complete_1_series', 1, 50, 'First Album', 'Premier album'),
  series('complete_10_series', 10, 300, 'Album Series', 'Albums en série'),
  series('complete_50_series', 50, 1000, 'Curator', 'Conservateur'),
  sell('sell_1', 1, 30, 'First Sale', 'Première vente'),
  sell('sell_10', 10, 100, 'Merchant', 'Marchand'),
  sell('sell_100', 100, 500, 'Wealth Manager', 'Gestion de patrimoine'),
  trade('trade_1', 1, 30, 'Handshake', 'Poignée de main'),
  trade('trade_25', 25, 250, 'Negotiator', 'Négociateur'),
]

const group = (...rules: ThemeRule[]): ThemeRule => ({ type: 'group', mode: 'all', rules })

/** Starting packs (GAME_DESIGN §5). Pools are built by core on first use. */
export const DEFAULT_THEMES = [
  {
    key: 'shonen',
    category: 'demographic',
    name: { en: 'Shōnen', fr: 'Shōnen' },
    description: { en: 'Heroes of shōnen series.', fr: 'Les héros des séries shōnen.' },
    rules: group({ type: 'tag', tag: 'Shounen', minRank: 60 }),
    artToken: 'shonen',
    sortOrder: 1,
  },
  {
    key: 'shojo',
    category: 'demographic',
    name: { en: 'Shōjo', fr: 'Shōjo' },
    description: { en: 'Characters of shōjo series.', fr: 'Les personnages des séries shōjo.' },
    rules: group({ type: 'tag', tag: 'Shoujo', minRank: 60 }),
    artToken: 'shojo',
    sortOrder: 2,
  },
  {
    key: 'seinen',
    category: 'demographic',
    name: { en: 'Seinen', fr: 'Seinen' },
    description: { en: 'Characters of seinen series.', fr: 'Les personnages des séries seinen.' },
    rules: group({ type: 'tag', tag: 'Seinen', minRank: 60 }),
    artToken: 'seinen',
    sortOrder: 3,
  },
  {
    key: 'sports',
    category: 'genre',
    name: { en: 'Sports', fr: 'Sport' },
    description: { en: 'Athletes and their teams.', fr: 'Les sportifs et leurs équipes.' },
    rules: group({ type: 'genre', genre: 'Sports' }),
    artToken: 'sports',
    sortOrder: 4,
  },
  {
    key: 'ecchi',
    category: 'genre',
    name: { en: 'Ecchi', fr: 'Ecchi' },
    description: { en: 'Characters of ecchi series.', fr: 'Les personnages des séries ecchi.' },
    rules: group({ type: 'genre', genre: 'Ecchi' }),
    artToken: 'ecchi',
    sortOrder: 5,
  },
  {
    key: 'waifus',
    category: 'characters',
    name: { en: 'Waifus', fr: 'Waifus' },
    description: { en: 'Female characters only.', fr: 'Uniquement des personnages féminins.' },
    rules: group({ type: 'gender', gender: 'female' }),
    artToken: 'waifus',
    sortOrder: 6,
  },
  {
    key: 'husbandos',
    category: 'characters',
    name: { en: 'Husbandos', fr: 'Husbandos' },
    description: { en: 'Male characters only.', fr: 'Uniquement des personnages masculins.' },
    rules: group({ type: 'gender', gender: 'male' }),
    artToken: 'husbandos',
    sortOrder: 7,
  },
] as const

/** Idempotent seed: inserts missing default rows, never overwrites admin changes. */
export async function seed(db: Executor): Promise<void> {
  await db.insert(catalogState).values({}).onConflictDoNothing()
  const keys = Object.keys(settingsSchemas) as SettingKey[]
  await db
    .insert(settings)
    .values(keys.map((key) => ({ key, value: defaultSettingValue(key) })))
    .onConflictDoNothing()
  await db
    .insert(rarities)
    .values(DEFAULT_RARITIES.map((rarity) => ({ ...rarity, name: { ...rarity.name } })))
    .onConflictDoNothing()
  await db
    .insert(boosterTiers)
    .values(
      DEFAULT_BOOSTER_TIERS.map((tier) => ({
        ...tier,
        name: { ...tier.name },
        description: { ...tier.description },
        weights: { ...tier.weights },
      })),
    )
    .onConflictDoNothing()
  await db
    .insert(missions)
    .values(DEFAULT_MISSIONS.map((mission) => ({ ...mission, name: { ...mission.name } })))
    .onConflictDoNothing()
  await db
    .insert(achievements)
    .values(
      DEFAULT_ACHIEVEMENTS.map((achievement, index) => ({
        ...achievement,
        params: achievement.params ?? {},
        sortOrder: index,
      })),
    )
    .onConflictDoNothing()
  await db
    .insert(themes)
    .values(
      DEFAULT_THEMES.map((theme) => ({
        ...theme,
        name: { ...theme.name },
        description: { ...theme.description },
      })),
    )
    .onConflictDoNothing()
}
