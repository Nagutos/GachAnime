<script setup lang="ts">
import { FEEDBACK_COMMENT_MAX } from '@gachanime/shared'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMyFeedbackQuery, useSubmitFeedbackMutation } from '@/api/progression'
import { useErrorMessage } from '@/app/errors'
import RequireSignIn from '@/components/RequireSignIn.vue'
import { playerUi } from '@/components/ui'

const { t } = useI18n()
const query = useMyFeedbackQuery()
const submit = useSubmitFeedbackMutation()
const errorMessage = useErrorMessage(submit.error)
const rating = ref(0)
const comment = ref('')
const saved = ref(false)

watch(
  () => query.data.value?.feedback,
  (value) => {
    if (!value) return
    rating.value = value.rating
    comment.value = value.comment ?? ''
  },
  { immediate: true },
)

async function save(): Promise<void> {
  saved.value = false
  if (rating.value < 1) return
  await submit.mutateAsync({ rating: rating.value, comment: comment.value || null })
  saved.value = true
}
</script>

<template>
  <main :class="[playerUi.page, 'max-w-2xl']">
    <RequireSignIn>
      <header>
        <h1 :class="playerUi.title">{{ t('feedback.title') }}</h1>
        <p class="text-mist-300">{{ t('feedback.subtitle') }}</p>
      </header>
      <form :class="[playerUi.panel, 'flex flex-col gap-4']" @submit.prevent="save">
        <fieldset>
          <legend class="mb-2 text-sm text-mist-300">{{ t('feedback.rating') }}</legend>
          <div class="flex gap-1" role="radiogroup" :aria-label="t('feedback.rating')">
            <button
              v-for="value in 5"
              :key="value"
              type="button"
              role="radio"
              :aria-checked="rating === value"
              :aria-label="t('feedback.stars', { count: value }, value)"
              class="text-3xl transition"
              :class="value <= rating ? 'text-gold-400' : 'text-night-500 hover:text-gold-400/60'"
              :data-testid="`rating-${value}`"
              @click="rating = value"
            >
              <svg viewBox="0 0 24 24" class="size-8 fill-current" aria-hidden="true">
                <path
                  d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z"
                />
              </svg>
            </button>
          </div>
        </fieldset>
        <label class="flex flex-col gap-1 text-sm text-mist-300">
          {{ t('feedback.comment') }}
          <textarea
            v-model="comment"
            rows="6"
            :maxlength="FEEDBACK_COMMENT_MAX"
            :class="playerUi.input"
            :placeholder="t('feedback.placeholder')"
          />
          <span class="self-end text-xs">{{ comment.length }} / {{ FEEDBACK_COMMENT_MAX }}</span>
        </label>
        <p v-if="errorMessage" :class="playerUi.error" role="alert">{{ errorMessage }}</p>
        <div class="flex items-center justify-end gap-3">
          <span v-if="saved" class="text-sm text-emerald-400" role="status">
            {{ t('feedback.thanks') }}
          </span>
          <button
            type="submit"
            class="rounded-xl bg-sakura-500 px-5 py-2 font-semibold text-white hover:bg-sakura-600 disabled:opacity-50"
            :disabled="rating < 1 || submit.isPending.value"
            data-testid="submit-feedback"
          >
            {{ query.data.value?.feedback ? t('feedback.update') : t('feedback.send') }}
          </button>
        </div>
      </form>
    </RequireSignIn>
  </main>
</template>
