<script setup lang="ts">
import type { AdminUser } from '@gachanime/shared'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useAdminUsersQuery, useUpdateUserMutation } from '@/api/admin'
import { useErrorMessage } from '@/app/errors'
import { useSession } from '@/app/session'
import AppSelect from '@/components/AppSelect.vue'
import AdminPagination from '../components/AdminPagination.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { ui } from '../ui'

const { t, n, d } = useI18n()
const { me } = useSession()
const search = ref('')
const debounced = refDebounced(search, 300)
const bannedOnly = ref(false)
const page = ref(1)
watch([debounced, bannedOnly], () => (page.value = 1))
const users = useAdminUsersQuery(
  computed(() => ({
    page: page.value,
    search: debounced.value || undefined,
    banned: bannedOnly.value ? ('true' as const) : undefined,
  })),
)
const update = useUpdateUserMutation()
const errorMessage = useErrorMessage(update.error)
const banning = ref<AdminUser | null>(null)
const banReason = ref('')
const banOpen = computed({
  get: () => banning.value !== null,
  set: (value) => {
    if (!value) banning.value = null
  },
})

async function confirmBan(): Promise<void> {
  if (!banning.value) return
  await update.mutateAsync({
    id: banning.value.id,
    changes: { banned: true, banReason: banReason.value.trim() || null },
  })
  banning.value = null
  banReason.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="font-display text-3xl font-bold">{{ t('admin.users.title') }}</h1>
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        :class="[ui.input, 'max-w-sm']"
        :placeholder="t('players.search')"
        :aria-label="t('players.search')"
      />
      <label class="flex items-center gap-2 text-sm text-mist-300">
        <input v-model="bannedOnly" type="checkbox" class="accent-sakura-500" />
        {{ t('admin.users.bannedOnly') }}
      </label>
    </div>
    <p v-if="errorMessage" :class="ui.error" role="alert">{{ errorMessage }}</p>
    <div v-if="users.data.value" class="overflow-x-auto rounded-2xl border border-night-700">
      <table :class="ui.table">
        <thead class="bg-night-900">
          <tr>
            <th :class="ui.th">{{ t('admin.users.columns.player') }}</th>
            <th :class="ui.th">{{ t('admin.users.columns.role') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.users.columns.gems') }}</th>
            <th :class="[ui.th, 'text-right']">{{ t('admin.users.columns.owned') }}</th>
            <th :class="ui.th">{{ t('admin.users.columns.joined') }}</th>
            <th :class="ui.th">
              <span class="sr-only">{{ t('admin.common.edit') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users.data.value.items"
            :key="user.id"
            class="border-t border-night-800"
            :class="{ 'opacity-60': user.banned }"
          >
            <td :class="ui.td">
              <RouterLink
                :to="{ name: 'profile', params: { username: user.username } }"
                class="font-semibold hover:text-sakura-400"
              >
                {{ user.displayName }}
              </RouterLink>
              <p class="text-xs text-mist-300">@{{ user.username }}</p>
              <p v-if="user.banned" class="text-xs text-rarity-mythic">
                {{ t('admin.users.banned')
                }}<template v-if="user.banReason"> · {{ user.banReason }}</template>
              </p>
            </td>
            <td :class="ui.td">
              <AppSelect
                :options="[
                  { value: 'user', label: t('admin.users.roles.user') },
                  { value: 'admin', label: t('admin.users.roles.admin') },
                ]"
                :model-value="user.role"
                :disabled="user.id === me?.id"
                :aria-label="t('admin.users.columns.role')"
                @update:model-value="
                  update.mutate({
                    id: user.id,
                    changes: {
                      role: $event as 'user' | 'admin',
                    },
                  })
                "
              />
            </td>
            <td :class="[ui.td, 'text-right tabular-nums']">{{ n(user.gemBalance, 'integer') }}</td>
            <td :class="[ui.td, 'text-right tabular-nums']">{{ n(user.owned, 'integer') }}</td>
            <td :class="ui.td">{{ d(new Date(user.createdAt), 'short') }}</td>
            <td :class="ui.td">
              <button
                v-if="user.banned"
                type="button"
                :class="ui.button"
                @click="update.mutate({ id: user.id, changes: { banned: false } })"
              >
                {{ t('admin.users.unban') }}
              </button>
              <button
                v-else-if="user.id !== me?.id"
                type="button"
                :class="ui.buttonDanger"
                @click="banning = user"
              >
                {{ t('admin.users.ban') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination
      v-if="users.data.value"
      v-model:page="page"
      :page-size="users.data.value.pageSize"
      :total="users.data.value.total"
    />
    <ConfirmDialog
      v-model:open="banOpen"
      :title="t('admin.users.banTitle', { name: banning?.displayName ?? '' })"
      :description="t('admin.users.banBody')"
      danger
      :pending="update.isPending.value"
      @confirm="confirmBan"
    >
      <label :class="ui.label">
        {{ t('admin.users.banReason') }}
        <input v-model="banReason" maxlength="300" :class="ui.input" />
      </label>
    </ConfirmDialog>
  </div>
</template>
