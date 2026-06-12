<!-- Local Repository Changed Files — NekoGit dashboard component. -->
<script setup lang="ts">
import { ExternalLinkIcon, Loader2Icon } from 'lucide-vue-next';

import { useLocalRepositoryPanelContext } from './localRepositoryPanelContext';

const { copy, state } = useLocalRepositoryPanelContext();
</script>

<template>
  <div
    v-if="
      state.desktopLocalRepositoryStatus.value?.exists &&
      (state.desktopChangedFilesLoading.value ||
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
    </div>
    <p v-if="state.desktopChangedFilesError.value" class="local-repo-files__error">
      {{ state.desktopChangedFilesError.value }}
    </p>
    <ul v-else class="local-repo-files__list">
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
            :title="file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path"
            @click="state.previewDesktopChangedFileDiff(file)"
          >
            <code>{{ file.status }}</code>
            <span class="local-repo-files__path">{{ file.path }}</span>
            <span class="local-repo-files__kind">
              {{ state.desktopChangedFileStatusLabels.value[file.statusKind] ?? file.statusKind }}
            </span>
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
