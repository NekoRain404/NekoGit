<!-- Create Repository Modal — Creates a personal GitHub repository with optional description, homepage, and initialization. -->
<script setup lang="ts">
import { FolderPlusIcon, Loader2Icon } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

const props = defineProps<{
  isVisible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created', repository: Record<string, unknown>): void;
}>();

const { t } = useI18n();
const apiFetch = useNekoGitApiFetch();
const name = ref('');
const description = ref('');
const homepage = ref('');
const isPrivate = ref(false);
const autoInit = ref(true);
const creating = ref(false);
const error = ref('');

const repositoryNamePattern = /^[A-Za-z0-9._-]+$/;
const normalizedName = computed(() => name.value.trim());
const canCreate = computed(() => {
  const value = normalizedName.value;
  return (
    !creating.value &&
    value.length > 0 &&
    value.length <= 100 &&
    repositoryNamePattern.test(value) &&
    /[A-Za-z0-9]/.test(value)
  );
});

watch(
  () => props.isVisible,
  (visible) => {
    if (!visible) return;
    name.value = '';
    description.value = '';
    homepage.value = '';
    isPrivate.value = false;
    autoInit.value = true;
    error.value = '';
  }
);

const handleClose = () => {
  if (creating.value) return;
  emit('close');
};

const createRepository = async () => {
  if (!canCreate.value) return;

  creating.value = true;
  error.value = '';
  try {
    const repository = await apiFetch<Record<string, unknown>>('/api/repos', {
      method: 'POST',
      body: {
        name: normalizedName.value,
        description: description.value,
        homepage: homepage.value,
        private: isPrivate.value,
        auto_init: autoInit.value,
      },
    });
    emit('created', repository);
  } catch (err: unknown) {
    error.value = getFetchErrorMessage(err, t('repoCreate.createFailed'));
  } finally {
    creating.value = false;
  }
};
</script>

<template>
  <div class="modal" :class="{ 'is-active': isVisible }">
    <div class="modal-background" @click="handleClose"></div>
    <div class="modal-card create-repository-modal">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ t('repoCreate.title') }}</p>
        <button
          class="delete"
          type="button"
          :disabled="creating"
          :aria-label="t('repoCreate.cancel')"
          @click="handleClose"
        ></button>
      </header>

      <section class="modal-card-body">
        <div v-if="error" class="notification is-danger is-light is-size-7 py-2 px-3 mb-4">
          {{ error }}
        </div>

        <div class="field">
          <label class="label is-size-7" for="create-repo-name">{{ t('repoCreate.name') }}</label>
          <div class="control">
            <input
              id="create-repo-name"
              v-model="name"
              class="input"
              type="text"
              maxlength="100"
              autocomplete="off"
              :placeholder="t('repoCreate.namePlaceholder')"
              :disabled="creating"
              @keyup.enter="createRepository"
            />
          </div>
          <p class="help">{{ t('repoCreate.nameHint') }}</p>
        </div>

        <div class="field">
          <label class="label is-size-7" for="create-repo-description">
            {{ t('repoCreate.description') }}
          </label>
          <div class="control">
            <textarea
              id="create-repo-description"
              v-model="description"
              class="textarea"
              rows="2"
              maxlength="350"
              :placeholder="t('repoCreate.descriptionPlaceholder')"
              :disabled="creating"
            ></textarea>
          </div>
        </div>

        <div class="field">
          <label class="label is-size-7" for="create-repo-homepage">
            {{ t('repoCreate.homepage') }}
          </label>
          <div class="control">
            <input
              id="create-repo-homepage"
              v-model="homepage"
              class="input"
              type="url"
              :placeholder="t('repoCreate.homepagePlaceholder')"
              :disabled="creating"
            />
          </div>
        </div>

        <label class="checkbox is-block mb-2">
          <input v-model="isPrivate" type="checkbox" :disabled="creating" />
          <span class="ml-2">{{ t('repoCreate.private') }}</span>
        </label>
        <p class="help mb-3">{{ t('repoCreate.privateHint') }}</p>

        <label class="checkbox is-block mb-2">
          <input v-model="autoInit" type="checkbox" :disabled="creating" />
          <span class="ml-2">{{ t('repoCreate.autoInit') }}</span>
        </label>
        <p class="help mb-0">{{ t('repoCreate.autoInitHint') }}</p>
      </section>

      <footer class="modal-card-foot">
        <button class="button" type="button" :disabled="creating" @click="handleClose">
          {{ t('repoCreate.cancel') }}
        </button>
        <button
          class="button is-primary ml-3"
          type="button"
          :disabled="!canCreate"
          @click="createRepository"
        >
          <Loader2Icon v-if="creating" :size="14" class="mr-2 spin-animation" />
          <FolderPlusIcon v-else :size="14" class="mr-2" />
          {{ creating ? t('repoCreate.creating') : t('repoCreate.create') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped lang="scss">
.create-repository-modal {
  width: min(38rem, calc(100vw - 2rem));
}
</style>
