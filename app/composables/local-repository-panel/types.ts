/// Type definitions for local repository panel actions, git actions, options, and localized copy strings.
import type { ComputedRef } from 'vue';

/** All possible user actions in the local repository panel toolbar. */
export type DesktopRepositoryAction =
  | 'adopt'
  | 'clone'
  | 'commit'
  | 'copy'
  | 'createPR'
  | 'fetch'
  | 'open'
  | 'pull'
  | 'push'
  | 'rebase'
  | 'abortRebase'
  | 'amend'
  | 'undoCommit'
  | 'stash'
  | 'terminal'
  | null;

/** Subset of actions that trigger a git network operation. */
export type DesktopRepositoryGitAction = 'fetch' | 'pull' | 'push';

/** Localized string keys used throughout the local repository panel UI. */
export type LocalRepositoryCopy = {
  adoptLocal: string;
  adoptingLocal: string;
  clone: string;
  copied: string;
  copyCloneUrl: string;
  gitAmend: string;
  gitAmending: string;
  gitUndoLastCommit: string;
  gitUndoingCommit: string;
  gitAhead: string;
  gitBehind: string;
  gitBranch: string;
  gitBranchesUnavailable: string;
  gitChanged: string;
  gitChangedFiles: string;
  gitClean: string;
  gitCommit: string;
  gitCommitChanges: string;
  gitCommitMessage: string;
  gitCommitting: string;
  gitConflicted: string;
  gitConflictActionUnavailable: string;
  gitAbortRebase: string;
  gitAbortingRebase: string;
  gitCheckoutRemoteBranch: string;
  gitCheckingOutRemoteBranch: string;
  gitCopied: string;
  gitCreateBranch: string;
  gitCreatingBranch: string;
  gitDeleteBranch: string;
  gitDeleted: string;
  gitDeletingBranch: string;
  gitDiff: string;
  gitDiffEmpty: string;
  gitDiffTruncated: string;
  gitLastCommit: string;
  gitFetch: string;
  gitFetching: string;
  gitModified: string;
  gitCommits: string;
  gitPublishBranch: string;
  gitPull: string;
  gitRebase: string;
  gitRebasing: string;
  gitPulling: string;
  gitPush: string;
  gitPushing: string;
  gitRenamed: string;
  gitShowAll: string;
  gitStaged: string;
  gitStage: string;
  gitStaging: string;
  gitStash: string;
  gitStashes: string;
  gitStashesUnavailable: string;
  gitStashing: string;
  gitPopStash: string;
  gitPoppingStash: string;
  gitApplyStash: string;
  gitApplyingStash: string;
  gitClearStashes: string;
  gitClearingStashes: string;
  gitSelectBranchToDelete: string;
  gitSwitchBranch: string;
  gitUnstaged: string;
  gitUnstage: string;
  gitUnstaging: string;
  gitUntracked: string;
  localChecking: string;
  localChangesUnavailable: string;
  localDiffUnavailable: string;
  localGitUnavailable: string;
  localHistoryUnavailable: string;
  localMissing: string;
  localRepository: string;
  localReady: string;
  openFile: string;
  openLocal: string;
  openTerminal: string;
  cancel: string;
  createPullRequest: string;
  createPullRequestHeadBranch: string;
  createPullRequestBaseBranch: string;
  createPullRequestTitle: string;
  createPullRequestDescription: string;
  createPullRequestTitlePlaceholder: string;
  createPullRequestDescriptionPlaceholder: string;
  confirmCommit: string;
  confirmAmend: string;
  confirmUndoCommit: string;
  gitCancelOperation: string;
  confirmClearStashes: string;
  confirmDeleteBranch: string;
  confirmPush: string;
  confirmRebase: string;
  confirmAbortRebase: string;
  creatingPullRequest: string;
  pullRequestCreated: string;
  noPullRequest: string;
  pullRequestN: string;
  checkoutPR: string;
  checkingOutPR: string;
  cloneFirst: string;
  prAlreadyExists: string;
};

/** Options accepted by the main `useLocalRepositoryPanel` composable. */
export type UseLocalRepositoryPanelOptions = {
  owner: ComputedRef<string>;
  repo: ComputedRef<string>;
  fallbackBranch: ComputedRef<string>;
  copy: ComputedRef<LocalRepositoryCopy>;
  formatDate: (value?: string | null) => string;
};
