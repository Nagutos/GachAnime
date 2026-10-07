<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ui } from '../ui'

/** English (required) and French name and description of a mission or achievement. */
const name = defineModel<{ en: string; fr?: string }>('name', { required: true })
const description = defineModel<{ en: string; fr?: string }>('description', { required: true })
const { t } = useI18n()
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <label :class="ui.label">
      {{ t('admin.objectives.nameEn') }}
      <input v-model.trim="name.en" required :class="ui.input" />
    </label>
    <label :class="ui.label">
      {{ t('admin.objectives.nameFr') }}
      <input v-model.trim="name.fr" :class="ui.input" />
    </label>
    <label :class="ui.label">
      {{ t('admin.objectives.descriptionEn') }}
      <input v-model.trim="description.en" :class="ui.input" />
    </label>
    <label :class="ui.label">
      {{ t('admin.objectives.descriptionFr') }}
      <input v-model.trim="description.fr" :class="ui.input" />
    </label>
  </div>
</template>
