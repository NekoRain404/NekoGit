<!-- Local Repository Panel — NekoGit dashboard component. -->
<script setup lang="ts">
import { AlertCircleIcon, CheckCircle2Icon, HardDriveIcon, Loader2Icon } from 'lucide-vue-next';
import { computed } from 'vue';

import type { LocalRepositoryCopy } from '~/composables/useLocalRepositoryPanel';

import LocalRepositoryActions from './LocalRepositoryActions.vue';
import LocalRepositoryChangedFiles from './LocalRepositoryChangedFiles.vue';
import LocalRepositoryCommitHistory from './LocalRepositoryCommitHistory.vue';
import LocalRepositoryGitSummary from './LocalRepositoryGitSummary.vue';
import { provideLocalRepositoryPanel } from './localRepositoryPanelContext';

const props = defineProps<{
  owner: string;
  repo: string;
  fallbackBranch: string;
  copy: LocalRepositoryCopy;
  formatDate: (value?: string | null) => string;
}>();

const ownerRef = computed(() => props.owner);
const repoRef = computed(() => props.repo);
const fallbackBranchRef = computed(() => props.fallbackBranch);
const copyRef = computed(() => props.copy);

const state = useLocalRepositoryPanel({
  owner: ownerRef,
  repo: repoRef,
  fallbackBranch: fallbackBranchRef,
  copy: copyRef,
  formatDate: props.formatDate,
});

provideLocalRepositoryPanel({
  copy: copyRef,
  formatDate: props.formatDate,
  state,
});
</script>

<template>
  <div
    v-if="state.desktopAvailable.value && state.desktopRepository.value"
    class="local-repo-card mb-4"
  >
    <div class="local-repo-card__header">
      <div class="local-repo-card__header-left">
        <HardDriveIcon :size="14" class="local-repo-card__icon" />
        <span class="local-repo-card__title">{{ copy.localRepository }}</span>
      </div>
      <span
        class="local-repo-status"
        :class="`local-repo-status--${state.desktopLocalRepositoryStatusTone.value}`"
      >
        <Loader2Icon
          v-if="state.desktopLocalRepositoryStatusTone.value === 'loading'"
          :size="12"
          class="spin-animation"
        />
        <CheckCircle2Icon
          v-else-if="state.desktopLocalRepositoryStatusTone.value === 'ready'"
          :size="12"
        />
        <AlertCircleIcon v-else :size="12" />
        <span>{{ state.desktopLocalRepositoryStatusLabel.value }}</span>
      </span>
    </div>
    <div class="local-repo-card__content">
      <div class="local-repo-panel">
        <p class="local-repo-panel__path" :title="state.desktopLocalRepositoryLocation.value">
          {{ state.desktopLocalRepositoryLocation.value }}
        </p>
        <LocalRepositoryGitSummary />
        <LocalRepositoryChangedFiles />
        <LocalRepositoryCommitHistory />
        <LocalRepositoryActions />
      </div>
    </div>
  </div>
</template>
