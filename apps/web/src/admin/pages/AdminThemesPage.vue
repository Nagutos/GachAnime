<script setup lang="ts">
import { resolveLocalizedText, THEME_CATEGORIES } from '@gachanime/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useAdminThemesQuery } from '@/api/admin'
import { ui } from '../ui'

const { t, n, locale } = useI18n()
const query = useAdminThemesQuery()
const groups = computed(() =>
  THEME_CATEGORIES.map((category) => ({
    category,
    themes: (query.data.value?.themes ?? []).filter((theme) => theme.category === category),
  })).filter((group) => group.themes.length > 0),
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-3xl font-bold">{{ t('admin.themes.title') }}</h1>
        <p class="text-mist-300">{{ t('admin.themes.help') }}</p>
      </div>
      <RouterLink :to="{ name: 'admin-theme-new' }" :class="ui.buttonPrimary">
        {{ t('admin.themes.new') }}
      </RouterLink>
    </div>
    <p v-if="query.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <section v-for="group in groups" :key="group.category" class="flex flex-col gap-2">
      <h2 class="font-display text-lg font-bold">
        {{ t(`boosters.packs.categories.${group.category}`) }}
      </h2>
      <div class="overflow-x-auto rounded-2xl border border-night-700">
        <table :class="ui.table">
          <thead class="bg-night-900">
            <tr>
              <th :class="ui.th">{{ t('admin.objectives.name') }}</th>
              <th :class="[ui.th, 'text-right']">{{ t('admin.themes.characters') }}</th>
              <th :class="ui.th">{{ t('admin.themes.availability') }}</th>
              <th :class="[ui.th, 'text-right']">{{ t('admin.themes.surcharge') }}</th>
              <th :class="ui.th">{{ t('admin.common.active') }}</th>
              <th :class="ui.th">
                <span class="sr-only">{{ t('admin.common.edit') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="theme in group.themes"
              :key="theme.id"
              class="border-t border-night-800"
              :class="{ 'opacity-50': !theme.isActive }"
              :data-testid="`theme-row-${theme.key}`"
            >
              <td :class="ui.td">
                <p class="font-semibold">{{ resolveLocalizedText(theme.name, locale) }}</p>
                <p class="text-xs text-mist-300">{{ theme.key }}</p>
              </td>
              <td
                :class="[
                  ui.td,
                  'text-right tabular-nums',
                  theme.characterCount === 0 ? 'text-rarity-mythic' : '',
                ]"
              >
                {{ n(theme.characterCount, 'integer') }}
              </td>
              <td :class="ui.td">
                <span v-if="theme.freeEnabled" class="mr-1 rounded bg-night-800 px-1.5 text-xs">
                  {{ t('admin.themes.free') }}
                </span>
                <span v-if="theme.paidEnabled" class="rounded bg-night-800 px-1.5 text-xs">
                  {{ t('admin.themes.paid') }}
                </span>
              </td>
              <td :class="[ui.td, 'text-right tabular-nums']">
                {{ n(theme.surchargePercent / 100, 'percent') }}
              </td>
              <td :class="ui.td">
                {{ theme.isActive ? t('admin.common.active') : t('admin.common.inactive') }}
              </td>
              <td :class="ui.td">
                <RouterLink
                  :to="{ name: 'admin-theme-edit', params: { id: theme.id } }"
                  :class="ui.button"
                >
                  {{ t('admin.common.edit') }}
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
