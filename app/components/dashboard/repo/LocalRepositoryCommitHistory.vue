<!-- Local Repository Commit History — Lists the recent commit history of a local repository with loading state. -->
<script setup lang="ts">
import { Loader2Icon } from 'lucide-vue-next';

import { useLocalRepositoryPanelContext } from './localRepositoryPanelContext';

const { copy, formatDate, state } = useLocalRepositoryPanelContext();
</script>

<template>
  <div
    v-if="
      state.desktopLocalRepositoryStatus.value?.exists &&
      (state.desktopCommitHistoryLoading.value ||
        state.desktopCommitHistory.value.length ||
        state.desktopCommitHistoryError.value)
    "
    class="local-repo-history"
  >
    <div class="local-repo-history__header">
      <span>{{ copy.gitCommits }}</span>
      <Loader2Icon
        v-if="state.desktopCommitHistoryLoading.value"
        :size="12"
        class="spin-animation"
      />
      <button
        v-else-if="
          state.desktopCommitHistory.value.length >= 6 && !state.commitHistoryExpanded.value
        "
        class="local-repo-files__more"
        type="button"
        @click="state.showAllDesktopCommitHistory"
      >
        {{ copy.gitShowAll }}
      </button>
    </div>
    <p v-if="state.desktopCommitHistoryError.value" class="local-repo-history__error">
      {{ state.desktopCommitHistoryError.value }}
    </p>
    <ol v-else class="local-repo-history__list">
      <li
        v-for="commit in state.desktopCommitHistory.value"
        :key="commit.oid"
        class="local-repo-history__item"
        :title="`${commit.shortOid} ${commit.summary}`"
      >
        <code>{{ commit.shortOid }}</code>
        <span class="local-repo-history__summary">{{ commit.summary }}</span>
        <span class="local-repo-history__meta">
          {{ commit.authorName }}
          <span aria-hidden="true">·</span>
          {{ formatDate(new Date(commit.authoredAt * 1000).toISOString()) }}
        </span>
      </li>
    </ol>
  </div>
</template>
