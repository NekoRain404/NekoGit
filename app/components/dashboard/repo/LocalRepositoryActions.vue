<!-- Local Repository Actions — NekoGit dashboard component. -->
<script setup lang="ts">
import {
  ArchiveIcon,
  CheckCircle2Icon,
  CopyIcon,
  DownloadIcon,
  FolderOpenIcon,
  GitPullRequestArrowIcon,
  GitPullRequestIcon,
  Loader2Icon,
  RefreshCwIcon,
  TerminalIcon,
  UploadIcon,
} from 'lucide-vue-next';
import { ref } from 'vue';

import CreatePullRequestForm from './CreatePullRequestForm.vue';
import { useLocalRepositoryPanelContext } from './localRepositoryPanelContext';

const { copy, state } = useLocalRepositoryPanelContext();

const showCreatePRForm = ref(false);

const handlePRCreated = async (pull: any) => {
  showCreatePRForm.value = false;
  await state.refreshAssociatedPullRequest();
};
</script>

<template>
  <div class="local-repo-panel__actions">
    <button
      class="local-repo-link local-repo-panel__action"
      :disabled="
        !state.desktopLocalRepositoryStatus.value?.exists || Boolean(state.desktopAction.value)
      "
      @click="state.openDesktopLocalRepository"
    >
      <Loader2Icon v-if="state.desktopAction.value === 'open'" :size="14" class="spin-animation" />
      <FolderOpenIcon v-else :size="14" />
      <span>{{ copy.openLocal }}</span>
    </button>
    <button
      class="local-repo-link local-repo-panel__action"
      :disabled="Boolean(state.desktopAction.value)"
      @click="state.cloneDesktopRepository"
    >
      <Loader2Icon v-if="state.desktopAction.value === 'clone'" :size="14" class="spin-animation" />
      <DownloadIcon v-else :size="14" />
      <span>{{ copy.clone }}</span>
    </button>
    <button
      class="local-repo-link local-repo-panel__action local-repo-panel__action--wide"
      :disabled="
        !state.desktopLocalRepositoryStatus.value?.exists || Boolean(state.desktopAction.value)
      "
      @click="state.openDesktopLocalRepositoryTerminal"
    >
      <Loader2Icon
        v-if="state.desktopAction.value === 'terminal'"
        :size="14"
        class="spin-animation"
      />
      <TerminalIcon v-else :size="14" />
      <span>{{ copy.openTerminal }}</span>
    </button>
    <button
      class="local-repo-link local-repo-panel__action local-repo-panel__action--wide"
      :disabled="
        !state.desktopLocalRepositoryStatus.value?.exists || Boolean(state.desktopAction.value)
      "
      @click="state.fetchDesktopLocalRepository"
    >
      <Loader2Icon v-if="state.desktopAction.value === 'fetch'" :size="14" class="spin-animation" />
      <RefreshCwIcon v-else :size="14" />
      <span>
        {{ state.desktopAction.value === 'fetch' ? copy.gitFetching : copy.gitFetch }}
      </span>
    </button>
    <button
      class="local-repo-link local-repo-panel__action local-repo-panel__action--wide"
      :disabled="
        !state.desktopLocalRepositoryStatus.value?.exists || Boolean(state.desktopAction.value)
      "
      @click="state.pullDesktopLocalRepository"
    >
      <Loader2Icon v-if="state.desktopAction.value === 'pull'" :size="14" class="spin-animation" />
      <GitPullRequestArrowIcon v-else :size="14" />
      <span>
        {{ state.desktopAction.value === 'pull' ? copy.gitPulling : copy.gitPull }}
      </span>
    </button>
    <button
      class="local-repo-link local-repo-panel__action local-repo-panel__action--wide"
      :disabled="
        !state.desktopLocalRepositoryStatus.value?.exists ||
        Boolean(state.desktopAction.value) ||
        !state.desktopLocalRepositoryGitStatus.value?.clean
      "
      @click="state.pushDesktopLocalRepository"
    >
      <Loader2Icon v-if="state.desktopAction.value === 'push'" :size="14" class="spin-animation" />
      <UploadIcon v-else :size="14" />
      <span>
        {{
          state.desktopAction.value === 'push' ? copy.gitPushing : state.desktopGitPushLabel.value
        }}
      </span>
    </button>
    <button
      class="local-repo-link local-repo-panel__action local-repo-panel__action--wide"
      :disabled="!state.desktopCanStashChanges.value"
      @click="state.stashDesktopLocalRepositoryChanges"
    >
      <Loader2Icon v-if="state.desktopAction.value === 'stash'" :size="14" class="spin-animation" />
      <ArchiveIcon v-else :size="14" />
      <span>
        {{ state.desktopAction.value === 'stash' ? copy.gitStashing : copy.gitStash }}
      </span>
    </button>
    <button
      class="local-repo-link local-repo-panel__action local-repo-panel__action--wide"
      :disabled="Boolean(state.desktopAction.value)"
      @click="state.copyDesktopCloneUrl"
    >
      <Loader2Icon v-if="state.desktopAction.value === 'copy'" :size="14" class="spin-animation" />
      <CheckCircle2Icon v-else-if="state.desktopCloneCopied.value" :size="14" />
      <CopyIcon v-else :size="14" />
      <span>
        {{ state.desktopCloneCopied.value ? copy.copied : copy.copyCloneUrl }}
      </span>
    </button>
    <template
      v-if="state.desktopLocalRepositoryGitStatus.value?.upstream && state.desktopLocalRepositoryGitStatus.value?.clean"
    >
      <button
        v-if="!state.associatedPullRequest.value"
        class="local-repo-link local-repo-panel__action local-repo-panel__action--wide"
        :disabled="Boolean(state.desktopAction.value)"
        @click="showCreatePRForm = true"
      >
        <GitPullRequestIcon v-if="state.desktopAction.value !== 'createPR'" :size="14" />
        <Loader2Icon v-else :size="14" class="spin-animation" />
        <span>{{ copy.createPullRequest }}</span>
      </button>
      <span
        v-else
        class="local-repo-link local-repo-panel__action local-repo-panel__action--wide local-repo-panel__action--pr-exists"
      >
        <GitPullRequestIcon :size="14" />
        <span>{{ copy.prAlreadyExists }}</span>
      </span>
    </template>
  </div>
  <CreatePullRequestForm
    v-if="showCreatePRForm"
    @close="showCreatePRForm = false"
    @created="handlePRCreated"
  />
</template>
