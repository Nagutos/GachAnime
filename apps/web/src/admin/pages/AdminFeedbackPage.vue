<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminFeedbackQuery } from '@/api/admin'
import AdminPagination from '../components/AdminPagination.vue'
import { ui } from '../ui'

const { t, n, d } = useI18n()
const page = ref(1)
const query = useAdminFeedbackQuery(page)
const data = computed(() => query.data.value)
const maxCount = computed(() => Math.max(1, ...(data.value?.distribution ?? [])))
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="font-display text-3xl font-bold">{{ t('admin.feedback.title') }}</h1>
    <p v-if="query.isPending.value" class="text-mist-300">{{ t('common.loading') }}</p>
    <template v-else-if="data">
      <section :class="[ui.card, 'flex flex-wrap items-center gap-8']">
        <div>
          <p class="text-sm text-mist-300">{{ t('admin.feedback.average') }}</p>
          <p class="font-display text-4xl font-bold text-gold-400 tabular-nums">
            {{ data.average === null ? '-' : n(data.average, 'decimal') }}
          </p>
          <p class="text-sm text-mist-300">
            {{ t('admin.common.results', { count: n(data.total, 'integer') }, data.total) }}
          </p>
        </div>
        <ul class="flex flex-1 flex-col gap-1 text-sm">
          <li
            v-for="(count, index) in [...data.distribution].reverse()"
            :key="index"
            class="flex items-center gap-2"
          >
            <span class="w-16 text-mist-300">
              {{ t('feedback.stars', { count: 5 - index }, 5 - index) }}
            </span>
            <span class="h-2 flex-1 overflow-hidden rounded-full bg-night-800">
              <span
                class="block h-full rounded-full bg-gold-400"
                :style="{ width: `${(count / maxCount) * 100}%` }"
              />
            </span>
            <span class="w-8 text-right tabular-nums">{{ n(count, 'integer') }}</span>
          </li>
        </ul>
      </section>
      <p v-if="data.items.length === 0" :class="ui.card">{{ t('admin.common.empty') }}</p>
      <ul v-else class="flex flex-col gap-3">
        <li v-for="item in data.items" :key="item.id" :class="[ui.card, 'flex flex-col gap-2']">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-semibold">
              {{ item.displayName }}
              <span class="text-sm font-normal text-mist-300">@{{ item.username }}</span>
            </p>
            <p class="text-sm text-mist-300">{{ d(new Date(item.updatedAt), 'long') }}</p>
          </div>
          <p
            class="text-gold-400"
            :aria-label="t('feedback.stars', { count: item.rating }, item.rating)"
          >
            {{ '★'.repeat(item.rating)
            }}<span class="text-night-500">{{ '★'.repeat(5 - item.rating) }}</span>
          </p>
          <p v-if="item.comment" class="whitespace-pre-line">{{ item.comment }}</p>
        </li>
      </ul>
      <AdminPagination v-model:page="page" :page-size="data.pageSize" :total="data.total" />
    </template>
  </div>
</template>
