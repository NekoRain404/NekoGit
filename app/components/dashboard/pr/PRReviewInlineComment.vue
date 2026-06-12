<!-- PRReview Inline Comment — NekoGit dashboard component. -->
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  path: string;
  line: number;
  body: string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:body', body: string): void;
  (e: 'save', path: string, line: number, body: string): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
const draft = computed({
  get: () => props.body,
  set: (body: string) => emit('update:body', body),
});
const trimmedDraft = computed(() => draft.value.trim());
</script>

<template>
  <div class="pr-review-inline-comment">
    <textarea
      v-model="draft"
      class="textarea pr-review-inline-comment__textarea"
      :placeholder="t('prReview.inlinePlaceholder')"
      rows="4"
      :disabled="submitting"
    />
    <div class="buttons is-justify-content-flex-end mt-2 mb-0">
      <button
        class="button is-small is-light"
        type="button"
        :disabled="submitting"
        @click="emit('cancel')"
      >
        {{ t('prReview.cancelDraft') }}
      </button>
      <button
        class="button is-small is-link"
        type="button"
        :disabled="submitting || !trimmedDraft"
        @click="emit('save', path, line, trimmedDraft)"
      >
        {{ t('prReview.saveDraft') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pr-review-inline-comment {
  padding: 0.75rem;
  border-top: 1px solid var(--nekogit-border);
  border-bottom: 1px solid var(--nekogit-border);
  background: var(--nekogit-draft-bg);
}

.pr-review-inline-comment__textarea {
  min-height: 7rem;
  border-radius: 6px;
  font-family: inherit;
}
</style>
