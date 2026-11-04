<!-- Issue Edit Modal — Modal form to edit an issue's title and description. -->
<template>
  <div class="modal" :class="{ 'is-active': isVisible }">
    <div class="modal-background" @click="handleClose"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ t('issueDetail.editIssue') }}</p>
        <button class="delete" @click="handleClose" aria-label="close" :disabled="loading"></button>
      </header>
      <section class="modal-card-body">
        <div v-if="error" class="notification is-danger is-light is-size-7 py-2 px-3 mb-4">
          {{ error }}
        </div>

        <div class="field">
          <label class="label is-size-7" for="issue-edit-title">
            {{ t('issueDetail.editIssueTitle') }}
          </label>
          <div class="control">
            <input
              id="issue-edit-title"
              v-model="title"
              class="input"
              type="text"
              :disabled="loading"
              @keyup.enter="submit"
            />
          </div>
          <p v-if="showTitleRequired" class="help is-danger">
            {{ t('issueDetail.issueTitleRequired') }}
          </p>
        </div>

        <div class="field mb-0">
          <label class="label is-size-7" for="issue-edit-body">
            {{ t('issueDetail.editIssueBody') }}
          </label>
          <div class="control">
            <textarea
              id="issue-edit-body"
              v-model="body"
              class="textarea"
              rows="10"
              :placeholder="t('issueDetail.editIssueBodyPlaceholder')"
              :disabled="loading"
            ></textarea>
          </div>
          <p class="help">{{ t('issueDetail.editIssueHint') }}</p>
        </div>
      </section>
      <footer class="modal-card-foot">
        <button class="button is-light" type="button" :disabled="loading" @click="handleClose">
          {{ t('issueDetail.cancelEditIssue') }}
        </button>
        <button
          class="button is-primary ml-4"
          type="button"
          :disabled="loading || !canSubmit"
          @click="submit"
        >
          <span v-if="loading" class="is-flex is-align-items-center">
            <LoadingIcon class="mr-2" :size="14" />
            {{ t('issueDetail.saving') }}
          </span>
          <span v-else>{{ t('issueDetail.saveIssueChanges') }}</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import LoadingIcon from '~/components/ui/LoadingIcon.vue';

const props = defineProps<{
  isVisible: boolean;
  loading: boolean;
  initialTitle: string;
  initialBody: string;
  error?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { title: string; body: string }): void;
}>();

const { t } = useI18n();
const title = ref(props.initialTitle);
const body = ref(props.initialBody);
const showTitleRequired = ref(false);

const canSubmit = computed(() => title.value.trim().length > 0 && !props.loading);

watch(
  () => props.isVisible,
  (isVisible) => {
    if (!isVisible) return;
    title.value = props.initialTitle;
    body.value = props.initialBody;
    showTitleRequired.value = false;
  }
);

const handleClose = () => {
  if (props.loading) return;
  emit('close');
};

const submit = () => {
  if (props.loading) return;

  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) {
    showTitleRequired.value = true;
    return;
  }

  showTitleRequired.value = false;
  emit('save', { title: trimmedTitle, body: body.value });
};
</script>
