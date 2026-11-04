<!-- Local Repository Stashes — Lists stashes stored in a local repository with a pop action per entry. -->
<script setup lang="ts">
import { ArchiveRestoreIcon, Loader2Icon } from 'lucide-vue-next';

import type { DesktopLocalRepositoryStash } from '~/composables/useDesktopRuntime';

import { useLocalRepositoryPanelContext } from './localRepositoryPanelContext';

const { copy, formatDate, state } = useLocalRepositoryPanelContext();

const stashDate = (stash: DesktopLocalRepositoryStash) =>
  stash.committedAt ? formatDate(new Date(stash.committedAt * 1000).toISOString()) : stash.date;
</script>

<template>
  <div
    v-if="
      state.desktopLocalRepositoryStatus.value?.exists &&
      (state.desktopStashesLoading.value ||
        state.desktopLocalRepositoryStashes.value?.stashes.length ||
        state.desktopStashesError.value)
    "
    class="local-repo-files"
  >
    <div class="local-repo-files__header">
      <span>{{ copy.gitStashes }}</span>
      <Loader2Icon v-if="state.desktopStashesLoading.value" :size="12" class="spin-animation" />
    </div>
    <p v-if="state.desktopStashesError.value" class="local-repo-files__error">
      {{ state.desktopStashesError.value }}
    </p>
    <ul v-else class="local-repo-files__list">
      <li
        v-for="stash in state.desktopLocalRepositoryStashes.value?.stashes ?? []"
        :key="stash.reference"
      >
        <div class="local-repo-files__row local-repo-stashes__row">
          <div class="local-repo-stashes__body" :title="stash.message">
            <span class="local-repo-stashes__message">{{ stash.message }}</span>
            <span class="local-repo-stashes__meta">
              <code>{{ stash.reference }}</code>
              <span>{{ stashDate(stash) }}</span>
            </span>
          </div>
          <button
            type="button"
            class="local-repo-files__open local-repo-stashes__pop"
            :disabled="state.desktopStashPoppingIndex.value !== null"
            :title="copy.gitPopStash"
            @click="state.popDesktopLocalRepositoryStash(stash.index)"
          >
            <Loader2Icon
              v-if="state.desktopStashPoppingIndex.value === stash.index"
              :size="12"
              class="spin-animation"
            />
            <ArchiveRestoreIcon v-else :size="12" />
            <span>
              {{
                state.desktopStashPoppingIndex.value === stash.index
                  ? copy.gitPoppingStash
                  : copy.gitPopStash
              }}
            </span>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.local-repo-stashes__row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.local-repo-stashes__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.local-repo-stashes__message {
  overflow: hidden;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-repo-stashes__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--nekogit-text-muted);
  font-size: 10px;
  white-space: nowrap;
}

.local-repo-stashes__meta code {
  color: var(--nekogit-text-muted);
  font-size: 10px;
}

.local-repo-stashes__pop {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  width: auto;
  height: 1.6rem;
  padding: 0 0.45rem;
  color: var(--nekogit-text-muted);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.local-repo-stashes__pop:hover:not(:disabled) {
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
}
</style>
