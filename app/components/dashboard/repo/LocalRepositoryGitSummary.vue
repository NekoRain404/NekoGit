<!-- Local Repository Git Summary — Shows git status summary (ahead/behind, branch, uncommitted counts) for a local repository. -->
<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  Loader2Icon,
  Trash2Icon,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { useLocalRepositoryPanelContext } from './localRepositoryPanelContext';

const { copy, state } = useLocalRepositoryPanelContext();
const router = useRouter();
const localePath = useLocalePath();
const deletableBranches = computed(() =>
  state.desktopLocalBranches.value.filter((branch) => !branch.current)
);

const openAssociatedPullRequest = () => {
  const pr = state.associatedPullRequest.value;
  const repo = state.desktopRepository.value;
  if (!pr || !repo) return;

  void router.push({
    path: localePath('/dashboard'),
    query: {
      tab: 'repos',
      pr: `${repo.owner}/${repo.repo}/${pr.number}`,
    },
  });
};
</script>

<template>
  <div
    v-if="state.desktopGitStatusVisible.value"
    class="local-repo-git"
    :class="`local-repo-git--${state.desktopGitStatusTone.value}`"
  >
    <div class="local-repo-git__summary">
      <span
        class="local-repo-git__branch"
        :title="
          state.desktopLocalRepositoryGitStatus.value?.upstream || state.desktopGitBranchLabel.value
        "
      >
        <GitBranchIcon :size="13" />
        <span class="local-repo-git__branch-label">
          {{ state.desktopGitBranchLabel.value }}
        </span>
        <span
          v-if="state.associatedPullRequest.value"
          class="local-repo-git__pr-badge"
          :title="state.associatedPullRequest.value.title"
          @click="openAssociatedPullRequest"
        >
          <GitPullRequestIcon :size="12" />
          <span>#{{ state.associatedPullRequest.value.number }}</span>
        </span>
        <span
          v-else-if="state.prLoading.value"
          class="local-repo-git__pr-badge local-repo-git__pr-badge--loading"
        >
          <Loader2Icon :size="10" class="spin-animation" />
        </span>
      </span>
      <span class="local-repo-git__state">
        <Loader2Icon v-if="state.desktopGitStatusLoading.value" :size="12" class="spin-animation" />
        <CheckCircle2Icon
          v-else-if="state.desktopLocalRepositoryGitStatus.value?.clean"
          :size="12"
        />
        <AlertCircleIcon v-else :size="12" />
        <span>{{ state.desktopGitStatusLabel.value }}</span>
      </span>
    </div>
    <p v-if="state.desktopGitStatusError.value" class="local-repo-git__error">
      {{ state.desktopGitStatusError.value }}
    </p>
    <template v-else-if="state.desktopLocalRepositoryGitStatus.value">
      <div
        v-if="state.desktopGitLastCommit.value"
        class="local-repo-git__commit"
        :title="`${state.desktopGitLastCommit.value.shortOid} ${state.desktopGitLastCommit.value.summary}`"
      >
        <span class="local-repo-git__commit-label">
          {{ copy.gitLastCommit }}
        </span>
        <span class="local-repo-git__commit-main">
          <code>{{ state.desktopGitLastCommit.value.shortOid }}</code>
          <span>{{ state.desktopGitLastCommit.value.summary }}</span>
        </span>
        <span class="local-repo-git__commit-meta">
          <span>{{ state.desktopGitLastCommit.value.authorName }}</span>
          <span v-if="state.desktopGitLastCommitTime.value">
            {{ state.desktopGitLastCommitTime.value }}
          </span>
        </span>
      </div>

      <div v-if="state.desktopGitSyncBadges.value.length" class="local-repo-git__sync">
        <span
          v-for="badge in state.desktopGitSyncBadges.value"
          :key="badge.label"
          class="local-repo-git__sync-badge"
        >
          <span>{{ badge.label }}</span>
          <strong>{{ badge.value }}</strong>
        </span>
      </div>

      <div
        v-if="
          state.desktopBranchesLoading.value ||
          state.desktopLocalBranches.value.length ||
          state.desktopBranchesError.value
        "
        class="local-repo-branches"
      >
        <div class="local-repo-branches__label">
          <span>{{ copy.gitSwitchBranch }}</span>
          <Loader2Icon
            v-if="state.desktopBranchesLoading.value || state.desktopBranchAction.value"
            :size="11"
            class="spin-animation"
          />
        </div>
        <p v-if="state.desktopBranchesError.value" class="local-repo-git__error">
          {{ state.desktopBranchesError.value }}
        </p>
        <select
          v-else
          class="local-repo-branches__select"
          :value="state.desktopLocalRepositoryGitStatus.value.branch ?? ''"
          :disabled="
            state.desktopBranchAction.value ||
            state.desktopGitStatusLoading.value ||
            !state.desktopLocalRepositoryGitStatus.value.clean ||
            state.desktopLocalBranches.value.length <= 1
          "
          :title="
            state.desktopLocalRepositoryGitStatus.value.clean
              ? copy.gitSwitchBranch
              : copy.gitChanged
          "
          @change="state.switchDesktopLocalRepositoryBranch"
        >
          <option
            v-for="branch in state.desktopLocalBranches.value"
            :key="branch.name"
            :value="branch.name"
          >
            {{ branch.upstream ? `${branch.name} -> ${branch.upstream}` : branch.name }}
          </option>
        </select>
        <div class="local-repo-branches__create">
          <input
            v-model="state.desktopNewBranchName.value"
            class="local-repo-branches__input"
            type="text"
            :placeholder="copy.gitCreateBranch"
            :disabled="
              state.desktopBranchAction.value ||
              state.desktopCreateBranchLoading.value ||
              state.desktopGitStatusLoading.value ||
              !state.desktopLocalRepositoryGitStatus.value.clean
            "
            @keyup.enter="state.createDesktopLocalRepositoryBranch"
          />
          <button
            type="button"
            class="local-repo-branches__create-button"
            :disabled="
              !state.desktopNewBranchName.value.trim() ||
              state.desktopBranchAction.value ||
              state.desktopCreateBranchLoading.value ||
              state.desktopGitStatusLoading.value ||
              !state.desktopLocalRepositoryGitStatus.value.clean
            "
            :title="copy.gitCreateBranch"
            @click="state.createDesktopLocalRepositoryBranch"
          >
            <Loader2Icon
              v-if="state.desktopCreateBranchLoading.value"
              :size="12"
              class="spin-animation"
            />
            <GitBranchIcon v-else :size="12" />
            <span>
              {{
                state.desktopCreateBranchLoading.value
                  ? copy.gitCreatingBranch
                  : copy.gitCreateBranch
              }}
            </span>
          </button>
        </div>
        <div v-if="state.desktopRemoteBranches.value.length" class="local-repo-branches__remote">
          <select
            v-model="state.desktopRemoteBranchName.value"
            class="local-repo-branches__select"
            :disabled="
              state.desktopBranchAction.value ||
              state.desktopCheckoutRemoteBranchLoading.value ||
              state.desktopGitStatusLoading.value ||
              !state.desktopLocalRepositoryGitStatus.value.clean
            "
            :title="
              state.desktopLocalRepositoryGitStatus.value.clean
                ? copy.gitCheckoutRemoteBranch
                : copy.gitChanged
            "
          >
            <option value="">
              {{ copy.gitCheckoutRemoteBranch }}
            </option>
            <option
              v-for="branch in state.desktopRemoteBranches.value"
              :key="branch.name"
              :value="branch.name"
              :disabled="!branch.checkoutable"
            >
              {{ branch.checkoutable ? branch.name : `${branch.name} -> ${branch.localName}` }}
            </option>
          </select>
          <button
            type="button"
            class="local-repo-branches__create-button"
            :disabled="
              !state.desktopRemoteBranchName.value ||
              state.desktopBranchAction.value ||
              state.desktopCheckoutRemoteBranchLoading.value ||
              state.desktopGitStatusLoading.value ||
              !state.desktopLocalRepositoryGitStatus.value.clean
            "
            :title="copy.gitCheckoutRemoteBranch"
            @click="state.checkoutDesktopRemoteLocalRepositoryBranch"
          >
            <Loader2Icon
              v-if="state.desktopCheckoutRemoteBranchLoading.value"
              :size="12"
              class="spin-animation"
            />
            <GitBranchIcon v-else :size="12" />
            <span>
              {{
                state.desktopCheckoutRemoteBranchLoading.value
                  ? copy.gitCheckingOutRemoteBranch
                  : copy.gitCheckoutRemoteBranch
              }}
            </span>
          </button>
        </div>
        <div v-if="deletableBranches.length" class="local-repo-branches__delete">
          <select
            v-model="state.desktopBranchToDelete.value"
            class="local-repo-branches__select"
            :disabled="
              state.desktopBranchAction.value ||
              state.desktopDeleteBranchLoading.value ||
              state.desktopGitStatusLoading.value
            "
            :title="copy.gitDeleteBranch"
          >
            <option value="">
              {{ copy.gitSelectBranchToDelete }}
            </option>
            <option v-for="branch in deletableBranches" :key="branch.name" :value="branch.name">
              {{ branch.name }}
            </option>
          </select>
          <button
            type="button"
            class="local-repo-branches__create-button"
            :disabled="
              !state.desktopBranchToDelete.value ||
              state.desktopBranchAction.value ||
              state.desktopDeleteBranchLoading.value ||
              state.desktopGitStatusLoading.value
            "
            :title="copy.gitDeleteBranch"
            @click="state.deleteDesktopLocalRepositoryBranch"
          >
            <Loader2Icon
              v-if="state.desktopDeleteBranchLoading.value"
              :size="12"
              class="spin-animation"
            />
            <Trash2Icon v-else :size="12" />
            <span>
              {{
                state.desktopDeleteBranchLoading.value
                  ? copy.gitDeletingBranch
                  : copy.gitDeleteBranch
              }}
            </span>
          </button>
        </div>
      </div>

      <div class="local-repo-git__changes">
        <span
          v-for="item in state.desktopGitChangeItems.value"
          :key="item.label"
          class="local-repo-git__change"
          :class="{
            'local-repo-git__change--active': item.value > 0,
            'local-repo-git__change--danger': item.tone === 'danger' && item.value > 0,
          }"
        >
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </span>
      </div>

      <form
        v-if="!state.desktopLocalRepositoryGitStatus.value.clean"
        class="local-repo-commit"
        @submit.prevent="state.commitDesktopLocalRepositoryChanges"
      >
        <div class="local-repo-commit__label">
          <span>{{ copy.gitCommitChanges }}</span>
          <Loader2Icon
            v-if="state.desktopAction.value === 'commit'"
            :size="11"
            class="spin-animation"
          />
        </div>
        <div class="local-repo-commit__controls">
          <input
            v-model="state.desktopCommitMessage.value"
            class="local-repo-commit__input"
            type="text"
            :placeholder="copy.gitCommitMessage"
            :disabled="
              Boolean(state.desktopAction.value) ||
              state.desktopGitStatusLoading.value ||
              state.desktopLocalRepositoryGitStatus.value.conflicted > 0
            "
          />
          <button
            type="submit"
            class="local-repo-commit__button"
            :disabled="!state.desktopCanCommitChanges.value"
            :title="copy.gitCommitChanges"
          >
            <Loader2Icon
              v-if="state.desktopAction.value === 'commit'"
              :size="12"
              class="spin-animation"
            />
            <GitCommitIcon v-else :size="12" />
            <span>
              {{ state.desktopAction.value === 'commit' ? copy.gitCommitting : copy.gitCommit }}
            </span>
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped lang="scss">
.local-repo-branches__delete {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.35rem;
  min-width: 0;
}

.local-repo-git__pr-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 999px;
  background: var(--nekogit-surface);
  color: var(--nekogit-info);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--nekogit-info-soft);
    border-color: var(--nekogit-info);
  }
}

.local-repo-git__pr-badge--loading {
  cursor: default;
  opacity: 0.5;
}
</style>
