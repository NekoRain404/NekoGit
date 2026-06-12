import { computed, type Ref } from 'vue';

import type {
  DesktopLocalRepositoryBranches,
  DesktopLocalRepositoryChangedFiles,
  DesktopLocalRepositoryCommitHistory,
  DesktopLocalRepositoryFileDiff,
  DesktopLocalRepositoryGitStatus,
  DesktopLocalRepositoryStatus,
} from '~/composables/useDesktopRuntime';

import type { DesktopRepositoryAction, UseLocalRepositoryPanelOptions } from './types';

type LocalRepositoryPanelViewModelOptions = UseLocalRepositoryPanelOptions & {
  desktopAction: Ref<DesktopRepositoryAction>;
  desktopCommitMessage: Ref<string>;
  desktopGitStatusError: Ref<string>;
  desktopGitStatusLoading: Ref<boolean>;
  desktopLocalRepositoryBranches: Ref<DesktopLocalRepositoryBranches | null>;
  desktopLocalRepositoryChangedFiles: Ref<DesktopLocalRepositoryChangedFiles | null>;
  desktopLocalRepositoryCommitHistory: Ref<DesktopLocalRepositoryCommitHistory | null>;
  desktopLocalRepositoryFileDiff: Ref<DesktopLocalRepositoryFileDiff | null>;
  desktopLocalRepositoryGitStatus: Ref<DesktopLocalRepositoryGitStatus | null>;
  desktopLocalRepositoryStatus: Ref<DesktopLocalRepositoryStatus | null>;
  desktopStatusError: Ref<string>;
  desktopStatusLoading: Ref<boolean>;
  desktopCloneUrl: Ref<string>;
};

/** Derives presentation-ready computed values from raw local repository state. */
export const useLocalRepositoryPanelViewModel = (options: LocalRepositoryPanelViewModelOptions) => {
  const desktopLocalRepositoryPath = computed(() => {
    const status = options.desktopLocalRepositoryStatus.value;
    return status?.exists ? (status.path ?? '') : '';
  });

  const desktopLocalRepositoryStatusLabel = computed(() => {
    if (options.desktopStatusLoading.value) return options.copy.value.localChecking;
    if (options.desktopLocalRepositoryStatus.value?.exists) return options.copy.value.localReady;
    return options.copy.value.localMissing;
  });

  const desktopLocalRepositoryStatusTone = computed(() => {
    if (options.desktopStatusLoading.value) return 'loading';
    if (options.desktopLocalRepositoryStatus.value?.exists) return 'ready';
    if (options.desktopStatusError.value) return 'error';
    return 'missing';
  });

  const desktopLocalRepositoryLocation = computed(
    () =>
      desktopLocalRepositoryPath.value ||
      options.desktopStatusError.value ||
      options.desktopCloneUrl.value
  );

  const desktopGitStatusVisible = computed(() => {
    return (
      options.desktopLocalRepositoryStatus.value?.exists &&
      (options.desktopGitStatusLoading.value ||
        Boolean(options.desktopLocalRepositoryGitStatus.value) ||
        Boolean(options.desktopGitStatusError.value))
    );
  });

  const desktopGitStatusTone = computed(() => {
    if (options.desktopGitStatusLoading.value) return 'loading';
    if (options.desktopGitStatusError.value) return 'error';
    if (options.desktopLocalRepositoryGitStatus.value?.clean) return 'clean';
    return 'changed';
  });

  const desktopGitStatusLabel = computed(() => {
    if (options.desktopGitStatusLoading.value) return options.copy.value.localChecking;
    if (options.desktopGitStatusError.value) return options.copy.value.localGitUnavailable;
    if (options.desktopLocalRepositoryGitStatus.value?.clean) return options.copy.value.gitClean;
    return options.copy.value.gitChanged;
  });

  const desktopGitBranchLabel = computed(
    () =>
      options.desktopLocalRepositoryGitStatus.value?.branch || options.fallbackBranch.value || '-'
  );

  const desktopGitLastCommit = computed(
    () => options.desktopLocalRepositoryGitStatus.value?.lastCommit
  );

  const desktopGitLastCommitTime = computed(() => {
    const authoredAt = desktopGitLastCommit.value?.authoredAt;
    if (!authoredAt) return '';

    return options.formatDate(new Date(authoredAt * 1000).toISOString());
  });

  const desktopLocalBranches = computed(
    () => options.desktopLocalRepositoryBranches.value?.branches ?? []
  );

  const desktopRemoteBranches = computed(
    () => options.desktopLocalRepositoryBranches.value?.remoteBranches ?? []
  );

  const desktopCommitHistory = computed(
    () => options.desktopLocalRepositoryCommitHistory.value?.commits ?? []
  );

  const desktopChangedFiles = computed(
    () => options.desktopLocalRepositoryChangedFiles.value?.files ?? []
  );

  const desktopFileDiffSections = computed(() => {
    const diff = options.desktopLocalRepositoryFileDiff.value;
    if (!diff) return [];

    return [
      { label: options.copy.value.gitStaged, value: diff.stagedDiff },
      { label: options.copy.value.gitUnstaged, value: diff.unstagedDiff },
      { label: options.copy.value.gitUntracked, value: diff.untrackedDiff },
    ].filter((section) => section.value.trim().length > 0);
  });

  const desktopGitSyncBadges = computed(() => {
    const status = options.desktopLocalRepositoryGitStatus.value;
    if (!status) return [];

    const badges: { label: string; value: number }[] = [];
    if (status.ahead > 0) badges.push({ label: options.copy.value.gitAhead, value: status.ahead });
    if (status.behind > 0) {
      badges.push({ label: options.copy.value.gitBehind, value: status.behind });
    }
    return badges;
  });

  const desktopGitPushLabel = computed(() => {
    const status = options.desktopLocalRepositoryGitStatus.value;
    return status?.upstream ? options.copy.value.gitPush : options.copy.value.gitPublishBranch;
  });

  const desktopGitChangeItems = computed(() => {
    const status = options.desktopLocalRepositoryGitStatus.value;
    const emptyStatus = {
      staged: 0,
      unstaged: 0,
      untracked: 0,
      conflicted: 0,
    };
    const counts = status ?? emptyStatus;

    return [
      { label: options.copy.value.gitStaged, value: counts.staged, tone: 'neutral' },
      { label: options.copy.value.gitUnstaged, value: counts.unstaged, tone: 'neutral' },
      { label: options.copy.value.gitUntracked, value: counts.untracked, tone: 'neutral' },
      { label: options.copy.value.gitConflicted, value: counts.conflicted, tone: 'danger' },
    ];
  });

  const desktopCanCommitChanges = computed(() => {
    const status = options.desktopLocalRepositoryGitStatus.value;
    return Boolean(
      options.desktopLocalRepositoryStatus.value?.exists &&
      status &&
      !status.clean &&
      status.conflicted === 0 &&
      options.desktopCommitMessage.value.trim() &&
      !options.desktopGitStatusLoading.value &&
      !options.desktopAction.value
    );
  });

  const desktopCanStashChanges = computed(() => {
    const status = options.desktopLocalRepositoryGitStatus.value;
    return Boolean(
      options.desktopLocalRepositoryStatus.value?.exists &&
      status &&
      !status.clean &&
      status.conflicted === 0 &&
      !options.desktopGitStatusLoading.value &&
      !options.desktopAction.value
    );
  });

  const desktopChangedFileStatusLabels = computed<Record<string, string>>(() => ({
    added: options.copy.value.gitStaged,
    conflict: options.copy.value.gitConflicted,
    copied: options.copy.value.gitCopied,
    deleted: options.copy.value.gitDeleted,
    modified: options.copy.value.gitModified,
    renamed: options.copy.value.gitRenamed,
    untracked: options.copy.value.gitUntracked,
  }));

  return {
    desktopCanCommitChanges,
    desktopCanStashChanges,
    desktopChangedFileStatusLabels,
    desktopChangedFiles,
    desktopCommitHistory,
    desktopFileDiffSections,
    desktopGitBranchLabel,
    desktopGitChangeItems,
    desktopGitLastCommit,
    desktopGitLastCommitTime,
    desktopGitPushLabel,
    desktopGitStatusLabel,
    desktopGitStatusTone,
    desktopGitStatusVisible,
    desktopGitSyncBadges,
    desktopLocalBranches,
    desktopRemoteBranches,
    desktopLocalRepositoryLocation,
    desktopLocalRepositoryStatusLabel,
    desktopLocalRepositoryStatusTone,
  };
};
