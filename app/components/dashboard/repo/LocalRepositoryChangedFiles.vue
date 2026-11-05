<!-- Local Repository Changed Files — Lists changed/uncommitted files of a local repository and links to their diffs. -->
<script setup lang="ts">
import { ExternalLinkIcon, Loader2Icon, MinusIcon, PlusIcon } from 'lucide-vue-next';

import { useLocalRepositoryPanelContext } from './localRepositoryPanelContext';

const { copy, state } = useLocalRepositoryPanelContext();
</script>

<template>
  <div
    v-if="
      state.desktopLocalRepositoryStatus.value?.exists &&
      (state.desktopChangedFilesLoading.value ||
        state.desktopChangedFileActionError.value ||
        state.desktopChangedFiles.value.length ||
        state.desktopChangedFilesError.value)
    "
    class="local-repo-files"
  >
    <div class="local-repo-files__header">
      <span>{{ copy.gitChangedFiles }}</span>
      <Loader2Icon
        v-if="state.desktopChangedFilesLoading.value"
        :size="12"
        class="spin-animation"
      />
      <button
        v-else-if="state.desktopChangedFiles.value.length >= 8 && !state.changedFilesExpanded.value"
        class="local-repo-files__more"
        type="button"
        @click="state.showAllDesktopChangedFiles"
      >
        {{ copy.gitShowAll }}
      </button>
    </div>
    <p v-if="state.desktopChangedFilesError.value" class="local-repo-files__error">
      {{ state.desktopChangedFilesError.value }}
    </p>
    <p v-if="state.desktopChangedFileActionError.value" class="local-repo-files__error">
      {{ state.desktopChangedFileActionError.value }}
    </p>
    <ul v-if="!state.desktopChangedFilesError.value" class="local-repo-files__list">
      <li v-for="file in state.desktopChangedFiles.value" :key="`${file.status}:${file.path}`">
        <div class="local-repo-files__row">
          <button
            type="button"
            class="local-repo-files__item"
            :class="{
              'local-repo-files__item--active':
                state.desktopSelectedChangedFilePath.value === file.path,
              'local-repo-files__item--conflict': file.conflicted,
              'local-repo-files__item--deleted': !file.openable,
            }"
            :title="
              file.conflicted
                ? copy.gitConflictActionUnavailable
                : file.previousPath
                  ? `${file.previousPath} -> ${file.path}`
                  : file.path
            "
            @click="state.previewDesktopChangedFileDiff(file)"
          >
            <code>{{ file.status }}</code>
            <span class="local-repo-files__path">{{ file.path }}</span>
            <span class="local-repo-files__kind">
              {{ state.desktopChangedFileStatusLabels.value[file.statusKind] ?? file.statusKind }}
            </span>
          </button>
          <div class="local-repo-files__actions">
            <button
              v-if="!file.conflicted && (file.unstaged || file.untracked)"
              type="button"
              class="local-repo-files__open"
              :disabled="
                state.desktopStagingChangedFilePaths.value[file.path] ||
                state.desktopUnstagingChangedFilePaths.value[file.path]
              "
              :title="copy.gitStage"
              @click="state.stageDesktopChangedFile(file)"
            >
              <Loader2Icon
                v-if="state.desktopStagingChangedFilePaths.value[file.path]"
                :size="12"
                class="spin-animation"
              />
              <PlusIcon v-else :size="12" />
            </button>
            <button
              v-if="!file.conflicted && file.staged"
              type="button"
              class="local-repo-files__open"
              :disabled="
                state.desktopStagingChangedFilePaths.value[file.path] ||
                state.desktopUnstagingChangedFilePaths.value[file.path]
              "
              :title="copy.gitUnstage"
              @click="state.unstageDesktopChangedFile(file)"
            >
              <Loader2Icon
                v-if="state.desktopUnstagingChangedFilePaths.value[file.path]"
                :size="12"
                class="spin-animation"
              />
              <MinusIcon v-else :size="12" />
            </button>
            <button
              type="button"
              class="local-repo-files__open"
              :disabled="!file.openable"
              :title="copy.openFile"
              @click="state.openDesktopChangedFile(file)"
            >
              <ExternalLinkIcon :size="12" />
            </button>
          </div>
        </div>
      </li>
    </ul>

    <div
      v-if="
        state.desktopFileDiffLoading.value ||
        state.desktopFileDiffError.value ||
        state.desktopLocalRepositoryFileDiff.value
      "
      class="local-repo-diff"
    >
      <div class="local-repo-diff__header">
        <span>{{ copy.gitDiff }}</span>
        <Loader2Icon v-if="state.desktopFileDiffLoading.value" :size="12" class="spin-animation" />
        <span
          v-else-if="state.desktopLocalRepositoryFileDiff.value?.truncated"
          class="local-repo-diff__badge"
        >
          {{ copy.gitDiffTruncated }}
        </span>
      </div>
      <p v-if="state.desktopFileDiffError.value" class="local-repo-files__error">
        {{ state.desktopFileDiffError.value }}
      </p>
      <p
        v-else-if="state.desktopLocalRepositoryFileDiff.value?.empty"
        class="local-repo-diff__empty"
      >
        {{ copy.gitDiffEmpty }}
      </p>
      <div v-else class="local-repo-diff__sections">
        <div
          v-for="section in state.desktopFileDiffSections.value"
          :key="section.label"
          class="local-repo-diff__section"
        >
          <span class="local-repo-diff__section-label">{{ section.label }}</span>
          <pre>{{ section.value }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.local-repo-files__row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.local-repo-files__actions {
  display: flex;
  gap: 0.35rem;
  min-width: 0;
}
</style>
