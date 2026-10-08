<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuditLogQuery } from '@/api/admin'
import AppSelect from '@/components/AppSelect.vue'
import AdminPagination from '../components/AdminPagination.vue'
import { ui } from '../ui'

const { t, d } = useI18n()
const page = ref(1)
const targetType = ref('')
watch(targetType, () => (page.value = 1))
const log = useAuditLogQuery(() => ({
  page: page.value,
  targetType: targetType.value || undefined,
}))
const items = computed(() => log.data.value?.items ?? [])
const targetTypes = ['series', 'character', 'import_job', 'user'] as const
const format = (value: unknown) => JSON.stringify(value, null, 2)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="font-display text-3xl font-bold">{{ t('admin.audit.title') }}</h1>
      <label :class="ui.label">
        {{ t('admin.audit.targetType') }}
        <AppSelect
          v-model="targetType"
          :options="[
            { value: '', label: t('admin.common.all') },
            ...targetTypes.map((type) => ({ value: type, label: type })),
          ]"
        />
      </label>
    </div>
    <div class="overflow-x-auto rounded-2xl border border-night-700">
      <table :class="ui.table">
        <thead class="bg-night-900">
          <tr>
            <th :class="ui.th">{{ t('admin.audit.columns.date') }}</th>
            <th :class="ui.th">{{ t('admin.audit.columns.actor') }}</th>
            <th :class="ui.th">{{ t('admin.audit.columns.action') }}</th>
            <th :class="ui.th">{{ t('admin.audit.columns.target') }}</th>
            <th :class="ui.th">{{ t('admin.audit.details') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in items" :key="entry.id" class="border-t border-night-800 align-top">
            <td :class="[ui.td, 'whitespace-nowrap text-mist-300']">
              {{ d(new Date(entry.createdAt), 'long') }}
            </td>
            <td :class="ui.td">{{ entry.actorName ?? t('admin.audit.system') }}</td>
            <td :class="[ui.td, 'font-mono text-xs']">{{ entry.action }}</td>
            <td :class="[ui.td, 'font-mono text-xs']">
              {{ entry.targetType }} #{{ entry.targetId }}
            </td>
            <td :class="ui.td">
              <details v-if="entry.before !== null || entry.after !== null" class="text-xs">
                <summary class="cursor-pointer text-mist-300">
                  {{ t('admin.audit.details') }}
                </summary>
                <div class="mt-2 grid gap-2 md:grid-cols-2">
                  <div v-if="entry.before !== null">
                    <p class="text-mist-300">{{ t('admin.audit.before') }}</p>
                    <pre class="max-h-60 overflow-auto rounded bg-night-950 p-2">{{
                      format(entry.before)
                    }}</pre>
                  </div>
                  <div v-if="entry.after !== null">
                    <p class="text-mist-300">{{ t('admin.audit.after') }}</p>
                    <pre class="max-h-60 overflow-auto rounded bg-night-950 p-2">{{
                      format(entry.after)
                    }}</pre>
                  </div>
                </div>
              </details>
            </td>
          </tr>
          <tr v-if="!log.isPending.value && items.length === 0">
            <td colspan="5" :class="[ui.td, 'py-8 text-center text-mist-300']">
              {{ t('admin.common.empty') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination
      v-if="log.data.value"
      v-model:page="page"
      :page-size="50"
      :total="log.data.value.total"
    />
  </div>
</template>
