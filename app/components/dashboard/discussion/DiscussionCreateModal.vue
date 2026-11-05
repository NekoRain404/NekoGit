<!-- DiscussionCreateModal — Modal form to create a new discussion with a category, title and body. -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

interface DiscussionCategory {
  id: string;
  name: string;
  emoji?: string;
  description?: string | null;
  isAnswerable?: boolean;
}

const props = defineProps<{
  isVisible: boolean;
  owner: string;
  repo: string;
  loading: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { title: string; body: string; categoryId: string }): void;
}>();

const { t } = useI18n();
const apiFetch = useNekoGitApiFetch();
const title = ref('');
const body = ref('');
const categoryId = ref('');
const categories = ref<DiscussionCategory[]>([]);
const loadingCategories = ref(false);
const categoriesError = ref('');
const showTitleRequired = ref(false);
const showBodyRequired = ref(false);
let requestId = 0;

const canSubmit = computed(
  () =>
    Boolean(title.value.trim()) &&
    Boolean(body.value.trim()) &&
    Boolean(categoryId.value) &&
    !props.loading &&
    !loadingCategories.value
);

const loadCategories = async () => {
  const currentRequestId = ++requestId;
  loadingCategories.value = true;
  categoriesError.value = '';
  try {
    const data = await apiFetch<{ items?: DiscussionCategory[] }>(
      `/api/repos/${props.owner}/${props.repo}/discussion-categories`,
      { method: 'GET' }
    );
    if (currentRequestId !== requestId) return;
    categories.value = Array.isArray(data?.items) ? data.items : [];
    if (!categoryId.value && categories.value.length > 0) {
      categoryId.value = categories.value[0]?.id ?? '';
    }
  } catch (err: unknown) {
    if (currentRequestId !== requestId) return;
    categories.value = [];
    categoriesError.value = getFetchErrorMessage(err, t('discussionDetail.categoryLoadFailed'));
  } finally {
    if (currentRequestId === requestId) {
      loadingCategories.value = false;
    }
  }
};

watch(
  () => props.isVisible,
  (isVisible) => {
    if (!isVisible) {
      requestId += 1;
      loadingCategories.value = false;
      return;
    }

    title.value = '';
    body.value = '';
    categoryId.value = '';
    categoriesError.value = '';
    showTitleRequired.value = false;
    showBodyRequired.value = false;
    void loadCategories();
  }
);

const handleClose = () => {
  if (props.loading) return;
  emit('close');
};

const submit = () => {
  if (props.loading) return;

  const trimmedTitle = title.value.trim();
  const trimmedBody = body.value.trim();
  showTitleRequired.value = !trimmedTitle;
  showBodyRequired.value = !trimmedBody;

  if (!trimmedTitle || !trimmedBody || !categoryId.value) return;

  emit('save', {
    title: trimmedTitle,
    body: trimmedBody,
    categoryId: categoryId.value,
  });
};
</script>

<template>
  <div class="modal" :class="{ 'is-active': isVisible }">
    <div class="modal-background" @click="handleClose"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ t('discussionDetail.newDiscussion') }}</p>
        <button class="delete" @click="handleClose" aria-label="close" :disabled="loading"></button>
      </header>
      <section class="modal-card-body">
        <div v-if="error" class="notification is-danger is-light is-size-7 py-2 px-3 mb-4">
          {{ error }}
        </div>
        <div
          v-if="categoriesError"
          class="notification is-warning is-light is-size-7 py-2 px-3 mb-4"
        >
          {{ categoriesError }}
        </div>

        <div class="field">
          <label class="label is-size-7" for="discussion-create-category">
            {{ t('discussionDetail.discussionCategory') }}
          </label>
          <div class="control">
            <div class="select is-fullwidth" :class="{ 'is-loading': loadingCategories }">
              <select
                id="discussion-create-category"
                v-model="categoryId"
                :disabled="loading || loadingCategories || categories.length === 0"
              >
                <option value="" disabled>
                  {{
                    categories.length === 0
                      ? t('discussionDetail.noCategories')
                      : t('discussionDetail.selectCategory')
                  }}
                </option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.emoji ? `${category.emoji} ` : '' }}{{ category.name }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="label is-size-7" for="discussion-create-title">
            {{ t('discussionDetail.discussionTitle') }}
          </label>
          <div class="control">
            <input
              id="discussion-create-title"
              v-model="title"
              class="input"
              type="text"
              :disabled="loading"
              @keyup.enter="submit"
            />
          </div>
          <p v-if="showTitleRequired" class="help is-danger">
            {{ t('discussionDetail.discussionTitleRequired') }}
          </p>
        </div>

        <div class="field mb-0">
          <label class="label is-size-7" for="discussion-create-body">
            {{ t('discussionDetail.discussionBody') }}
          </label>
          <div class="control">
            <textarea
              id="discussion-create-body"
              v-model="body"
              class="textarea"
              rows="8"
              :placeholder="t('discussionDetail.discussionBodyPlaceholder')"
              :disabled="loading"
            ></textarea>
          </div>
          <p v-if="showBodyRequired" class="help is-danger">
            {{ t('discussionDetail.discussionBodyRequired') }}
          </p>
        </div>
      </section>
      <footer class="modal-card-foot">
        <button class="button is-light" type="button" :disabled="loading" @click="handleClose">
          {{ t('discussionDetail.cancel') }}
        </button>
        <button class="button is-primary ml-4" type="button" :disabled="!canSubmit" @click="submit">
          <span v-if="loading" class="is-flex is-align-items-center">
            <LoadingIcon class="mr-2" :size="14" />
            {{ t('discussionDetail.creatingDiscussion') }}
          </span>
          <span v-else>{{ t('discussionDetail.createDiscussion') }}</span>
        </button>
      </footer>
    </div>
  </div>
</template>
