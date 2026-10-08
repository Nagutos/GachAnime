<script setup lang="ts">
import { resolveLocalizedText, type AdminTheme } from '@gachanime/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useAdminThemesQuery, useReorderThemesMutation } from '@/api/admin'
import ChevronIcon from '@/components/ChevronIcon.vue'
import SealMark from '@/components/SealMark.vue'
import { useErrorMessage } from '../use-admin-error'
import { ui } from '../ui'

const { t, n, locale } = useI18n()
const query = useAdminThemesQuery()
const reorder = useReorderThemesMutation()
const errorMessage = useErrorMessage(reorder.error)
const saved = ref(false)

/** Pack ids in the order shown; differs from the server order until saved. */
const order = ref<number[]>([])
const serverOrder = computed(() => (query.data.value?.themes ?? []).map((theme) => theme.id))
watch(serverOrder, (ids) => (order.value = [...ids]), { immediate: true })
const dirty = computed(() => order.value.join() !== serverOrder.value.join())
const rows = computed(() => {
  const byId = new Map((query.data.value?.themes ?? []).map((theme) => [theme.id, theme]))
  return order.value.map((id) => byId.get(id)).filter((theme): theme is AdminTheme => !!theme)
})

const nameOf = (theme: AdminTheme) => resolveLocalizedText(theme.name, locale.value)

function move(from: number, to: number): void {
  if (to < 0 || to >= order.value.length || from === to) return
  const next = [...order.value]
  const [id] = next.splice(from, 1)
  next.splice(to, 0, id!)
  order.value = next
  saved.value = false
}

/** Drag and drop (pointer); the arrow buttons do the same from the keyboard or a phone. */
const dragged = ref<number | null>(null)
function onDragOver(index: number): void {
  if (dragged.value === null || dragged.value === index) return
  move(dragged.value, index)
  dragged.value = index
}

async function saveOrder(): Promise<void> {
  saved.value = false
  await reorder.mutateAsync(order.value)
  saved.value = true
}
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
    <section v-else class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-display text-lg font-bold">{{ t('admin.themes.reorder') }}</h2>
          <p class="text-sm text-mist-300">{{ t('admin.themes.reorderHelp') }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="saved && !dirty" class="text-sm text-emerald-400">
            {{ t('admin.themes.orderSaved') }}
          </span>
          <button v-if="dirty" type="button" :class="ui.button" @click="order = [...serverOrder]">
            {{ t('admin.common.cancel') }}
          </button>
          <button
            type="button"
            :class="ui.buttonPrimary"
            :disabled="!dirty || reorder.isPending.value"
            data-testid="save-theme-order"
            @click="saveOrder"
          >
            {{ t('admin.themes.saveOrder') }}
          </button>
        </div>
      </div>
      <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
      <div class="overflow-x-auto rounded-2xl border border-night-700">
        <table :class="ui.table">
          <thead class="bg-night-900">
            <tr>
              <th :class="[ui.th, 'w-24']">
                <span class="sr-only">{{ t('admin.themes.reorder') }}</span>
              </th>
              <th :class="ui.th">{{ t('admin.objectives.name') }}</th>
              <th :class="ui.th">{{ t('admin.themes.category') }}</th>
              <th :class="[ui.th, 'text-right']">{{ t('admin.themes.characters') }}</th>
              <th :class="ui.th">{{ t('admin.common.active') }}</th>
              <th :class="ui.th">
                <span class="sr-only">{{ t('admin.common.edit') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(theme, index) in rows"
              :key="theme.id"
              class="border-t border-night-800 transition-colors"
              :class="[{ 'opacity-50': !theme.isActive }, dragged === index ? 'bg-night-800' : '']"
              :data-testid="`theme-row-${theme.key}`"
              @dragover.prevent="onDragOver(index)"
              @drop.prevent="dragged = null"
            >
              <td :class="ui.td">
                <div class="flex items-center gap-1">
                  <span
                    draggable="true"
                    class="cursor-grab px-1 text-mist-300 hover:text-mist-100 active:cursor-grabbing"
                    :title="t('admin.themes.dragHandle', { name: nameOf(theme) })"
                    aria-hidden="true"
                    @dragstart="dragged = index"
                    @dragend="dragged = null"
                  >
                    <svg viewBox="0 0 20 20" class="size-4 fill-current">
                      <circle cx="7" cy="5" r="1.5" />
                      <circle cx="13" cy="5" r="1.5" />
                      <circle cx="7" cy="10" r="1.5" />
                      <circle cx="13" cy="10" r="1.5" />
                      <circle cx="7" cy="15" r="1.5" />
                      <circle cx="13" cy="15" r="1.5" />
                    </svg>
                  </span>
                  <button
                    type="button"
                    class="rounded p-1 text-mist-300 hover:bg-night-800 hover:text-mist-100 disabled:opacity-30"
                    :disabled="index === 0"
                    :aria-label="t('admin.themes.moveUp', { name: nameOf(theme) })"
                    @click="move(index, index - 1)"
                  >
                    <ChevronIcon direction="up" />
                  </button>
                  <button
                    type="button"
                    class="rounded p-1 text-mist-300 hover:bg-night-800 hover:text-mist-100 disabled:opacity-30"
                    :disabled="index === rows.length - 1"
                    :aria-label="t('admin.themes.moveDown', { name: nameOf(theme) })"
                    @click="move(index, index + 1)"
                  >
                    <ChevronIcon direction="down" />
                  </button>
                </div>
              </td>
              <td :class="ui.td">
                <div class="flex items-center gap-3">
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    :style="{ backgroundColor: theme.color }"
                  >
                    <SealMark :glyph="theme.seal" class="size-6 text-night-950/80" />
                  </span>
                  <div>
                    <p class="font-semibold">{{ nameOf(theme) }}</p>
                    <p class="text-xs text-mist-300">{{ theme.key }}</p>
                  </div>
                </div>
              </td>
              <td :class="ui.td">{{ t(`boosters.packs.categories.${theme.category}`) }}</td>
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
