import { resolveLocalizedText } from '@gachanime/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRaritiesQuery } from '@/api/player'

/** Configured rarities (lowest first) with their name in the current locale. */
export function usePlayerRarities() {
  const query = useRaritiesQuery()
  const { locale, t } = useI18n()
  const rarities = computed(() => query.data.value?.rarities ?? [])
  const nameOf = (key: string) => {
    const rarity = rarities.value.find((item) => item.key === key)
    return rarity ? resolveLocalizedText(rarity.name, locale.value) : key
  }
  /** Rarity rank (1 = lowest), 0 when unknown. */
  const rankOf = (key: string) => rarities.value.find((item) => item.key === key)?.sortOrder ?? 0
  /** Options of a rarity filter: "all", then the highest rarity first. */
  const filterOptions = computed(() => [
    { value: '', label: t('collection.allRarities') },
    ...[...rarities.value].reverse().map((item) => ({ value: item.key, label: nameOf(item.key) })),
  ])
  return { rarities, nameOf, rankOf, filterOptions }
}
