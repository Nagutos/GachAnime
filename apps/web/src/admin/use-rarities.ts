import { resolveLocalizedText } from '@gachanime/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCatalogStatsQuery } from '@/api/admin'

/** Configured rarities (ordered) with their name in the current locale. */
export function useRarities() {
  const stats = useCatalogStatsQuery()
  const { locale } = useI18n()
  const rarities = computed(() => stats.data.value?.rarities ?? [])
  const nameOf = (key: string) => {
    const rarity = rarities.value.find((item) => item.key === key)
    return rarity ? resolveLocalizedText(rarity.name, locale.value) : key
  }
  return { rarities, nameOf, stats }
}
