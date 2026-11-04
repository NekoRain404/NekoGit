<!-- Label Create Form — Inline form to create a repository label from the label editor. -->
<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

interface CreatedLabel {
  id?: number | string;
  name: string;
  color: string;
  description?: string | null;
}

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const emit = defineEmits<{
  (e: 'created', label: CreatedLabel): void;
}>();

const { t } = useI18n();
const apiFetch = useNekoGitApiFetch();
const isOpen = ref(false);
const name = ref('');
const color = ref('#0969da');
const description = ref('');
const saving = ref(false);
const error = ref('');

const reset = () => {
  name.value = '';
  color.value = '#0969da';
  description.value = '';
  error.value = '';
};

const toggle = () => {
  if (saving.value) return;
  isOpen.value = !isOpen.value;
  if (!isOpen.value) reset();
};

const submit = async () => {
  if (saving.value) return;
  if (!name.value.trim()) {
    error.value = t('issueDetail.labelNameRequired');
    return;
  }

  saving.value = true;
  error.value = '';
  try {
    const label = await apiFetch<CreatedLabel>(`/api/repos/${props.owner}/${props.repo}/labels`, {
      method: 'POST',
      body: {
        name: name.value.trim(),
        color: color.value.replace(/^#/, ''),
        description: description.value.trim() || undefined,
      },
    });

    emit('created', label);
    reset();
    isOpen.value = false;
  } catch (err: unknown) {
    error.value = getFetchErrorMessage(err, t('issueDetail.createLabelFailed'));
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="label-create">
    <button class="label-create__toggle" type="button" :disabled="saving" @click="toggle">
      {{ isOpen ? t('issueDetail.cancelCreateLabel') : t('issueDetail.createLabel') }}
    </button>

    <form v-if="isOpen" class="label-create__form" @submit.prevent="submit">
      <div class="label-create__row">
        <input
          v-model="name"
          class="input is-small"
          type="text"
          :placeholder="t('issueDetail.labelName')"
          :disabled="saving"
          required
        />
        <input
          v-model="color"
          class="label-create__color"
          type="color"
          :aria-label="t('issueDetail.labelColor')"
          :disabled="saving"
        />
      </div>
      <input
        v-model="description"
        class="input is-small"
        type="text"
        :placeholder="t('issueDetail.labelDescription')"
        :disabled="saving"
      />
      <p v-if="error" class="label-create__error">{{ error }}</p>
      <button class="label-create__submit" type="submit" :disabled="saving">
        <LoadingIcon v-if="saving" :size="12" :spinning="true" />
        <span>{{ saving ? t('issueDetail.creatingLabel') : t('issueDetail.createLabel') }}</span>
      </button>
    </form>
  </div>
</template>

<style scoped lang="scss">
.label-create {
  margin-top: 0.75rem;
  border-top: 1px solid var(--nekogit-border);
  padding-top: 0.75rem;
}

.label-create__toggle {
  border: 0;
  background: transparent;
  color: var(--bulma-link, #3b82f6);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
}

.label-create__form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.label-create__row {
  display: flex;
  gap: 0.5rem;
}

.label-create__row .input {
  flex: 1;
  min-width: 0;
}

.label-create__color {
  width: 2.5rem;
  height: 2rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 4px;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.label-create__error {
  margin: 0;
  color: var(--bulma-danger, #cc0f35);
  font-size: 0.75rem;
}

.label-create__submit {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 0;
  border-radius: 4px;
  padding: 0.3rem 0.65rem;
  background: var(--bulma-primary, #485fc7);
  color: #fff;
  font-size: 0.75rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
