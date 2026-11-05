<!-- PRReview Commit Selector — Dropdown to pick which commit the review is based on. -->
<script setup lang="ts">
import { ChevronDownIcon } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';

const { t } = useI18n();

interface CommitItem {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  date: string;
}

const props = defineProps<{
  commits: CommitItem[];
  selectedSha: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', sha: string): void;
}>();

const isOpen = shallowRef(false);

const selectedCommit = computed(
  () => props.commits.find((c) => c.sha === props.selectedSha) ?? props.commits[0] ?? null
);

const handleSelect = (sha: string) => {
  isOpen.value = false;
  if (sha !== props.selectedSha) {
    emit('select', sha);
  }
};

watch(
  () => props.selectedSha,
  () => {
    isOpen.value = false;
  }
);
</script>

<template>
  <div class="pr-review-commit-selector">
    <button
      class="pr-review-commit-selector__trigger"
      type="button"
      :disabled="loading || !commits.length"
      @click="isOpen = !isOpen"
    >
      <span v-if="loading" class="pr-review-commit-selector__loading">
        {{ t('prReview.loadingCommits') }}
      </span>
      <template v-else-if="selectedCommit">
        <span class="pr-review-commit-selector__sha">{{ selectedCommit.shortSha }}</span>
        <span class="pr-review-commit-selector__message">{{ selectedCommit.message }}</span>
        <span class="pr-review-commit-selector__author">{{ selectedCommit.authorName }}</span>
      </template>
      <span v-else class="pr-review-commit-selector__placeholder">
        {{ t('prReview.selectCommit') }}
      </span>
      <ChevronDownIcon :size="14" class="pr-review-commit-selector__chevron" />
    </button>
    <div v-if="isOpen" class="pr-review-commit-selector__dropdown">
      <button
        v-for="commit in commits"
        :key="commit.sha"
        class="pr-review-commit-selector__option"
        :class="{ 'pr-review-commit-selector__option--active': commit.sha === selectedSha }"
        type="button"
        @click="handleSelect(commit.sha)"
      >
        <span class="pr-review-commit-selector__option-sha">{{ commit.shortSha }}</span>
        <span class="pr-review-commit-selector__option-message">{{ commit.message }}</span>
        <span class="pr-review-commit-selector__option-author">{{ commit.authorName }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pr-review-commit-selector {
  position: relative;
  flex: none;
}

.pr-review-commit-selector__trigger {
  min-height: 1.65rem;
  max-width: 18rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  background: var(--nekogit-surface);
  color: var(--nekogit-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 600;
  overflow: hidden;

  &:hover:not(:disabled) {
    border-color: var(--nekogit-border-strong);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.pr-review-commit-selector__sha {
  font-family: var(--nekogit-code-font-family);
  color: var(--nekogit-info);
  flex: none;
}

.pr-review-commit-selector__message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.pr-review-commit-selector__author {
  flex: none;
  color: var(--nekogit-text-muted);
  font-size: 0.65rem;
}

.pr-review-commit-selector__chevron {
  flex: none;
  color: var(--nekogit-text-muted);
}

.pr-review-commit-selector__loading {
  color: var(--nekogit-text-muted);
  font-style: italic;
}

.pr-review-commit-selector__placeholder {
  color: var(--nekogit-text-muted);
}

.pr-review-commit-selector__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  min-width: 20rem;
  max-height: 16rem;
  overflow-y: auto;
  margin-top: 4px;
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  background: var(--nekogit-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.pr-review-commit-selector__option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 0;
  background: transparent;
  color: var(--nekogit-text-strong);
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--nekogit-surface-hover);
  }
}

.pr-review-commit-selector__option--active {
  background: var(--nekogit-info-soft);
  color: var(--nekogit-info);
}

.pr-review-commit-selector__option-sha {
  font-family: var(--nekogit-code-font-family);
  font-size: 0.7rem;
  flex: none;
  color: var(--nekogit-info);
}

.pr-review-commit-selector__option-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.pr-review-commit-selector__option-author {
  flex: none;
  color: var(--nekogit-text-muted);
  font-size: 0.65rem;
}
</style>
