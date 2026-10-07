<script setup lang="ts">
import type { AdminCharacter, GenderClassValue } from '@gachanime/shared'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useUpdateCharacterMutation } from '@/api/admin'
import { useErrorMessage } from '../use-admin-error'
import { useRarities } from '../use-rarities'
import { rarityClasses, ui } from '../ui'
import ImageUploadButton from './ImageUploadButton.vue'

defineProps<{ items: AdminCharacter[] }>()
const emit = defineEmits<{ edit: [character: AdminCharacter] }>()
const { t, n } = useI18n()
const { rarities, nameOf } = useRarities()
const update = useUpdateCharacterMutation()
const errorMessage = useErrorMessage(update.error)
const genders: GenderClassValue[] = ['female', 'male', 'unclassified']
const SERIES_SHOWN = 2

function setRarity(character: AdminCharacter, value: string | null): void {
  update.mutate({ id: character.id, rarity: value })
}

function setGender(character: AdminCharacter, value: string): void {
  update.mutate({ id: character.id, genderOverride: value ? (value as GenderClassValue) : null })
}

/** AniList characters: the select shows the override ('' = AniList value); manual: the class. */
function genderValue(character: AdminCharacter): string {
  return character.source === 'manual' ? character.genderClass : (character.genderOverride ?? '')
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
    <div class="overflow-x-auto rounded-2xl border border-night-700">
      <table :class="ui.table">
        <thead class="bg-night-900">
          <tr>
            <th :class="ui.th">{{ t('admin.characters.columns.character') }}</th>
            <th :class="ui.th">{{ t('admin.characters.columns.series') }}</th>
            <th :class="ui.th">{{ t('admin.characters.columns.rarity') }}</th>
            <th :class="ui.th">{{ t('admin.characters.columns.gender') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.characters.columns.favourites') }}</th>
            <th :class="ui.th">{{ t('admin.characters.columns.status') }}</th>
            <th :class="ui.th">
              <span class="sr-only">{{ t('admin.common.edit') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="character in items"
            :key="character.id"
            class="border-t border-night-800"
            :class="{ 'opacity-50': !character.isActive }"
            data-testid="character-row"
          >
            <td :class="ui.td">
              <div class="flex items-center gap-3">
                <img
                  v-if="character.imageUrl"
                  :src="character.imageUrl"
                  alt=""
                  loading="lazy"
                  class="h-14 w-10 shrink-0 rounded-md bg-night-800 object-cover"
                />
                <div
                  v-else
                  class="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-night-800 text-center text-[10px] text-mist-300"
                >
                  {{ t('admin.common.noImage') }}
                </div>
                <div class="min-w-0">
                  <a
                    v-if="character.anilistId"
                    :href="`https://anilist.co/character/${character.anilistId}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold hover:text-sakura-400"
                    :title="t('admin.common.openOnAniList')"
                  >
                    {{ character.nameFull }}
                  </a>
                  <span v-else class="font-semibold">{{ character.nameFull }}</span>
                  <p v-if="character.nameNative" class="text-xs text-mist-300">
                    {{ character.nameNative }}
                  </p>
                  <p class="mt-1 flex flex-wrap gap-1">
                    <span
                      v-for="role in character.roles"
                      :key="role"
                      class="rounded bg-night-800 px-1.5 text-[11px] text-mist-300"
                    >
                      {{ t(`admin.roles.${role}`) }}
                    </span>
                  </p>
                </div>
              </div>
            </td>
            <td :class="[ui.td, 'max-w-48']">
              <RouterLink
                v-for="item in character.series.slice(0, SERIES_SHOWN)"
                :key="item.id"
                :to="{ name: 'admin-series-detail', params: { id: item.id } }"
                class="block truncate text-mist-300 hover:text-sakura-400"
              >
                {{ item.title }}
              </RouterLink>
              <span v-if="character.series.length > SERIES_SHOWN" class="text-xs text-mist-300">
                {{ t('admin.characters.more', { count: character.series.length - SERIES_SHOWN }) }}
              </span>
            </td>
            <td :class="ui.td">
              <div class="flex flex-col gap-1">
                <select
                  :value="character.rarityKey"
                  :class="[ui.select, 'border', rarityClasses[character.rarityKey]]"
                  :aria-label="t('admin.characters.columns.rarity')"
                  data-testid="rarity-select"
                  @change="setRarity(character, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="rarity in rarities" :key="rarity.key" :value="rarity.key">
                    {{ nameOf(rarity.key) }}
                  </option>
                </select>
                <span
                  v-if="character.rarityOverridden && character.defaultRarityKey"
                  class="flex items-center gap-1 text-[11px] text-gold-400"
                >
                  {{
                    t('admin.characters.defaultRarity', {
                      rarity: nameOf(character.defaultRarityKey),
                    })
                  }}
                  <button type="button" class="underline" @click="setRarity(character, null)">
                    {{ t('admin.characters.resetRarity') }}
                  </button>
                </span>
              </div>
            </td>
            <td :class="ui.td">
              <select
                :value="genderValue(character)"
                :class="ui.select"
                :aria-label="t('admin.characters.columns.gender')"
                @change="setGender(character, ($event.target as HTMLSelectElement).value)"
              >
                <option v-if="character.source === 'anilist'" value="">
                  {{
                    t('admin.characters.imported', {
                      gender: t(`admin.genders.${character.genderClass}`),
                    })
                  }}
                </option>
                <option v-for="gender in genders" :key="gender" :value="gender">
                  {{ t(`admin.genders.${gender}`) }}
                </option>
              </select>
            </td>
            <td :class="[ui.td, 'text-right tabular-nums']">
              {{ character.favourites === null ? '-' : n(character.favourites, 'integer') }}
            </td>
            <td :class="ui.td">
              <SwitchRoot
                :model-value="character.isActive"
                :aria-label="t('admin.characters.toggleActive')"
                class="relative h-6 w-11 rounded-full bg-night-700 transition data-[state=checked]:bg-sakura-500"
                @update:model-value="
                  (value: boolean) => update.mutate({ id: character.id, isActive: value })
                "
              >
                <SwitchThumb
                  class="block size-5 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-5.5"
                />
              </SwitchRoot>
            </td>
            <td :class="ui.td">
              <div class="flex items-center justify-end gap-2">
                <button
                  v-if="character.source === 'manual'"
                  type="button"
                  :class="ui.button"
                  @click="emit('edit', character)"
                >
                  {{ t('admin.common.edit') }}
                </button>
                <ImageUploadButton :id="character.id" target="characters" />
              </div>
            </td>
          </tr>
          <tr v-if="items.length === 0">
            <td colspan="7" :class="[ui.td, 'py-8 text-center text-mist-300']">
              {{ t('admin.common.empty') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
