<!-- CreatePullRequestForm — NekoGit dashboard component. -->
<script setup lang="ts">
import { GitPullRequestIcon, Loader2Icon, XIcon } from 'lucide-vue-next';
import { onMounted } from 'vue';
import { useLocalRepositoryPanelContext } from './localRepositoryPanelContext';

const emit = defineEmits<{
  close: [];
  created: [pull: any];
}>();

const { copy, state } = useLocalRepositoryPanelContext();

// Pre-fill base branch from repo default branch on mount
onMounted(async () => {
  if (!state.createPullRequestBaseBranch.value) {
    const repo = state.desktopRepository.value;
    if (repo) {
      try {
        const apiFetch = useNekoGitApiFetch();
        const { default_branch } = await apiFetch<{ default_branch: string }>(
          `/api/repos/${repo.owner}/${repo.repo}/default-branch`
        );
        state.createPullRequestBaseBranch.value = default_branch;
      } catch {
        // Fallback: leave empty for user to type
      }
    }
  }
});

const handleSubmit = async () => {
  try {
    const pull = await state.submitCreatePullRequest();
    if (pull) {
      emit('created', pull);
    }
  } catch {
    // Error handled within the composable
  }
};
</script>

<template>
  <div class="create-pr-overlay" @click.self="emit('close')">
    <div class="create-pr-form card">
      <div class="create-pr-form__header">
        <span class="create-pr-form__title">
          <GitPullRequestIcon :size="16" />
          {{ copy.createPullRequest }}
        </span>
        <button class="create-pr-form__close" type="button" @click="emit('close')">
          <XIcon :size="16" />
        </button>
      </div>
      <div class="card-content">
        <div class="field">
          <label class="label">{{ copy.gitSwitchBranch }}</label>
          <input
            class="input"
            :value="state.desktopLocalRepositoryGitStatus.value?.branch"
            disabled
          />
        </div>
        <div class="field">
          <label class="label">Base</label>
          <input
            v-model="state.createPullRequestBaseBranch.value"
            class="input"
            type="text"
            :placeholder="copy.gitBranch"
          />
        </div>
        <div class="field">
          <label class="label">{{ copy.gitCommitMessage }}</label>
          <input
            v-model="state.createPullRequestTitle.value"
            class="input"
            type="text"
            placeholder="PR title"
            required
          />
        </div>
        <div class="field">
          <label class="label">Description</label>
          <textarea
            v-model="state.createPullRequestBody.value"
            class="textarea"
            rows="4"
            placeholder="PR description (optional)"
          />
        </div>
        <div class="create-pr-form__actions">
          <button
            class="button is-light"
            type="button"
            @click="emit('close')"
          >
            {{ copy.cancel }}
          </button>
          <button
            class="button is-primary"
            type="button"
            :disabled="!state.createPullRequestTitle.value.trim() || !state.createPullRequestBaseBranch.value.trim() || state.desktopAction.value === 'createPR'"
            @click="handleSubmit"
          >
            <Loader2Icon v-if="state.desktopAction.value === 'createPR'" :size="14" class="spin-animation" />
            <GitPullRequestIcon v-else :size="14" />
            <span>{{ state.desktopAction.value === 'createPR' ? copy.creatingPullRequest : copy.createPullRequest }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.create-pr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.create-pr-form {
  width: min(90vw, 36rem);
  max-height: 90vh;
  overflow-y: auto;
}

.create-pr-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--nekogit-border);
}

.create-pr-form__title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
}

.create-pr-form__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--nekogit-text-muted);
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: var(--nekogit-surface-hover);
    color: var(--nekogit-text-strong);
  }
}

.create-pr-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
