<!-- PREditModal — Modal for editing a pull request title and description. -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  visible: boolean;
  title?: string;
  body?: string;
  saving: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { title: string; body: string }): void;
}>();

const { t } = useI18n();
const draftTitle = ref('');
const draftBody = ref('');

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    draftTitle.value = props.title ?? '';
    draftBody.value = props.body ?? '';
  },
  { immediate: true }
);

const canSave = computed(() => Boolean(draftTitle.value.trim()) && !props.saving);

const submit = () => {
  if (!canSave.value) return;
  emit('save', {
    title: draftTitle.value.trim(),
    body: draftBody.value,
  });
};
</script>

<template>
  <div v-if="visible" class="pr-edit-overlay" @click.self="emit('close')">
    <form class="pr-edit-form card" @submit.prevent="submit">
      <div class="pr-edit-form__header">
        <span class="pr-edit-form__title">{{ t('prReview.editPr') }}</span>
        <button class="pr-edit-form__close" type="button" @click="emit('close')">
          {{ t('prReview.cancel') }}
        </button>
      </div>

      <div class="card-content">
        <div class="field">
          <label class="label" for="pr-edit-title">{{ t('prReview.editTitle') }}</label>
          <input
            id="pr-edit-title"
            v-model="draftTitle"
            class="input"
            type="text"
            :disabled="saving"
            required
          />
        </div>

        <div class="field">
          <label class="label" for="pr-edit-body">{{ t('prReview.editBody') }}</label>
          <textarea
            id="pr-edit-body"
            v-model="draftBody"
            class="textarea"
            rows="8"
            :disabled="saving"
            :placeholder="t('prReview.editBodyPlaceholder')"
          />
        </div>

        <p v-if="error" class="pr-edit-form__error">{{ error }}</p>

        <div class="pr-edit-form__actions">
          <button class="button is-light" type="button" :disabled="saving" @click="emit('close')">
            {{ t('prReview.cancel') }}
          </button>
          <button class="button is-primary" type="submit" :disabled="!canSave">
            {{ saving ? t('prReview.saving') : t('prReview.save') }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped lang="scss">
.pr-edit-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.pr-edit-form {
  width: min(90vw, 44rem);
  max-height: 90vh;
  overflow-y: auto;
}

.pr-edit-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--nekogit-border);
}

.pr-edit-form__title {
  font-weight: 600;
  font-size: 1rem;
}

.pr-edit-form__close {
  border: 0;
  background: transparent;
  color: var(--nekogit-text-muted);
  cursor: pointer;
}

.pr-edit-form__error {
  margin: 0.75rem 0 0;
  color: var(--bulma-danger, #cc0f35);
  font-size: 0.85rem;
}

.pr-edit-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
