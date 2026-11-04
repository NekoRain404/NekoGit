<!-- Repository Settings Modal — Edits description/homepage, toggles archive state, and deletes a repository. -->
<script setup lang="ts">
import { ArchiveIcon, Loader2Icon, SaveIcon, Trash2Icon } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

const props = defineProps<{
  isVisible: boolean;
  owner: string;
  repo: string;
  repository: Record<string, unknown>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated', repository: Record<string, unknown>): void;
  (e: 'deleted'): void;
}>();

const { t } = useI18n();
const apiFetch = useNekoGitApiFetch();
const description = ref('');
const homepage = ref('');
const confirmation = ref('');
const error = ref('');
const saving = ref(false);
const archiving = ref(false);
const deleting = ref(false);

const repositoryPath = computed(() => `/api/repos/${props.owner}/${props.repo}`);
const isArchived = computed(() => Boolean(props.repository.archived));
const isBusy = computed(() => saving.value || archiving.value || deleting.value);
const canDelete = computed(
  () => confirmation.value === props.repo && !isBusy.value && Boolean(props.repo)
);

watch(
  () => props.isVisible,
  (visible) => {
    if (!visible) return;
    description.value =
      typeof props.repository.description === 'string' ? props.repository.description : '';
    homepage.value = typeof props.repository.homepage === 'string' ? props.repository.homepage : '';
    confirmation.value = '';
    error.value = '';
  }
);

const handleClose = () => {
  if (isBusy.value) return;
  emit('close');
};

const patchRepository = async (payload: Record<string, unknown>) => {
  return apiFetch<Record<string, unknown>>(repositoryPath.value, {
    method: 'PATCH',
    body: payload,
  });
};

const saveDetails = async () => {
  if (isBusy.value) return;
  saving.value = true;
  error.value = '';
  try {
    const updated = await patchRepository({
      description: description.value,
      homepage: homepage.value,
    });
    emit('updated', updated);
  } catch (err: unknown) {
    error.value = getFetchErrorMessage(err, t('repoSettings.saveFailed'));
  } finally {
    saving.value = false;
  }
};

const toggleArchive = async () => {
  if (isBusy.value) return;
  archiving.value = true;
  error.value = '';
  try {
    const updated = await patchRepository({ archived: !isArchived.value });
    emit('updated', updated);
  } catch (err: unknown) {
    error.value = getFetchErrorMessage(err, t('repoSettings.archiveFailed'));
  } finally {
    archiving.value = false;
  }
};

const deleteRepository = async () => {
  if (!canDelete.value) return;
  deleting.value = true;
  error.value = '';
  try {
    await apiFetch(repositoryPath.value, {
      method: 'DELETE',
      body: { confirmName: confirmation.value },
    });
    emit('deleted');
  } catch (err: unknown) {
    error.value = getFetchErrorMessage(err, t('repoSettings.deleteFailed'));
  } finally {
    deleting.value = false;
  }
};
</script>

<template>
  <div class="modal" :class="{ 'is-active': isVisible }">
    <div class="modal-background" @click="handleClose"></div>
    <div class="modal-card repo-settings-modal">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ t('repoSettings.title', { repo }) }}</p>
        <button
          class="delete"
          type="button"
          :disabled="isBusy"
          :aria-label="t('repoSettings.cancel')"
          @click="handleClose"
        ></button>
      </header>

      <section class="modal-card-body">
        <div v-if="error" class="notification is-danger is-light is-size-7 py-2 px-3 mb-4">
          {{ error }}
        </div>

        <div class="field">
          <label class="label is-size-7" for="repo-settings-description">
            {{ t('repoSettings.description') }}
          </label>
          <div class="control">
            <textarea
              id="repo-settings-description"
              v-model="description"
              class="textarea"
              rows="3"
              maxlength="350"
              :placeholder="t('repoSettings.descriptionPlaceholder')"
              :disabled="isBusy"
            ></textarea>
          </div>
          <p class="help">{{ t('repoSettings.descriptionHint') }}</p>
        </div>

        <div class="field">
          <label class="label is-size-7" for="repo-settings-homepage">
            {{ t('repoSettings.homepage') }}
          </label>
          <div class="control">
            <input
              id="repo-settings-homepage"
              v-model="homepage"
              class="input"
              type="url"
              :placeholder="t('repoSettings.homepagePlaceholder')"
              :disabled="isBusy"
            />
          </div>
          <p class="help">{{ t('repoSettings.homepageHint') }}</p>
        </div>

        <div class="repo-settings-modal__row">
          <button class="button is-light" type="button" :disabled="isBusy" @click="toggleArchive">
            <Loader2Icon v-if="archiving" :size="14" class="mr-2 spin-animation" />
            <ArchiveIcon v-else :size="14" class="mr-2" />
            {{
              archiving
                ? t('repoSettings.archiving')
                : isArchived
                  ? t('repoSettings.unarchive')
                  : t('repoSettings.archive')
            }}
          </button>
          <span class="repo-settings-modal__hint">{{ t('repoSettings.archiveHint') }}</span>
        </div>

        <hr />

        <div class="repo-settings-modal__danger">
          <p class="has-text-weight-semibold mb-2">{{ t('repoSettings.dangerZone') }}</p>
          <p class="is-size-7 mb-3">{{ t('repoSettings.deleteWarning', { repo }) }}</p>
          <label class="label is-size-7" for="repo-settings-confirm">
            {{ t('repoSettings.confirmLabel', { repo }) }}
          </label>
          <input
            id="repo-settings-confirm"
            v-model="confirmation"
            class="input mb-3"
            type="text"
            autocomplete="off"
            :placeholder="repo"
            :disabled="isBusy"
          />
          <button
            class="button is-danger"
            type="button"
            :disabled="!canDelete"
            @click="deleteRepository"
          >
            <Loader2Icon v-if="deleting" :size="14" class="mr-2 spin-animation" />
            <Trash2Icon v-else :size="14" class="mr-2" />
            {{ deleting ? t('repoSettings.deleting') : t('repoSettings.delete') }}
          </button>
        </div>
      </section>

      <footer class="modal-card-foot">
        <button class="button" type="button" :disabled="isBusy" @click="handleClose">
          {{ t('repoSettings.cancel') }}
        </button>
        <button
          class="button is-primary ml-3"
          type="button"
          :disabled="isBusy"
          @click="saveDetails"
        >
          <Loader2Icon v-if="saving" :size="14" class="mr-2 spin-animation" />
          <SaveIcon v-else :size="14" class="mr-2" />
          {{ saving ? t('repoSettings.saving') : t('repoSettings.save') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped lang="scss">
.repo-settings-modal {
  width: min(42rem, calc(100vw - 2rem));
}

.repo-settings-modal__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.repo-settings-modal__hint {
  color: var(--nekogit-text-muted);
  font-size: 0.75rem;
}

.repo-settings-modal__danger {
  padding: 0.85rem;
  border: 1px solid color-mix(in srgb, var(--bulma-danger) 35%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bulma-danger) 6%, transparent);
}
</style>
