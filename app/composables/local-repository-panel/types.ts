import type { ComputedRef } from 'vue';

/** All possible user actions in the local repository panel toolbar. */
export type DesktopRepositoryAction =
  | 'clone'
  | 'commit'
  | 'copy'
  | 'fetch'
  | 'open'
  | 'pull'
  | 'push'
  | 'stash'
  | 'terminal'
  | null;

/** Subset of actions that trigger a git network operation. */
export type DesktopRepositoryGitAction = 'fetch' | 'pull' | 'push';

/** Localized string keys used throughout the local repository panel UI. */
export type LocalRepositoryCopy = {
  clone: string;
  copied: string;
  copyCloneUrl: string;
  gitAhead: string;
  gitBehind: string;
  gitBranchesUnavailable: string;
  gitChanged: string;
  gitChangedFiles: string;
  gitClean: string;
  gitCommit: string;
  gitCommitChanges: string;
  gitCommitMessage: string;
  gitCommitting: string;
  gitConflicted: string;
  gitCheckoutRemoteBranch: string;
  gitCheckingOutRemoteBranch: string;
  gitCopied: string;
  gitCreateBranch: string;
  gitCreatingBranch: string;
  gitDeleted: string;
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
  gitPulling: string;
  gitPush: string;
  gitPushing: string;
  gitRenamed: string;
  gitStaged: string;
  gitStash: string;
  gitStashing: string;
  gitSwitchBranch: string;
  gitUnstaged: string;
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
  createPullRequest: string;
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
