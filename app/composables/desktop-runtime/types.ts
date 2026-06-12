/** Shape of the desktop runtime information returned by Tauri. */
export type DesktopRuntimeInfo = {
  productName: string;
  version: string;
  platform: string;
  clientUrl: string;
  appDataDir: string;
  serverLogPath: string;
  webviewDataDir: string;
  userSettingsDir: string;
  serverEntry?: string;
  nodeBinary?: string;
  bundledServer: boolean;
  externalClient: boolean;
  debugBuild: boolean;
};

/** Current state of the bundled backend server process. */
export type DesktopServerStatus = {
  bundledServer: boolean;
  running: boolean;
  pid?: number;
  port?: number;
  address?: string;
  clientUrl?: string;
  logPath: string;
  lastExitStatus?: string;
};

/** Whether OS-level auto-start is supported and currently enabled. */
export type DesktopAutostartStatus = {
  supported: boolean;
  enabled: boolean;
  path?: string;
};

/** Back/forward capability flags synced to the desktop window chrome. */
export interface DesktopNavigationState {
  canGoBack: boolean;
  canGoForward: boolean;
}

/** Toolbar action availability for the current PR review session. */
export interface DesktopReviewState {
  active: boolean;
  canSelectPreviousFile: boolean;
  canSelectNextFile: boolean;
  canSelectNextUnviewedFile: boolean;
  canToggleCurrentFileViewed: boolean;
  canToggleFileSidebar: boolean;
  canToggleReviewPanel: boolean;
}

/** Flags indicating whether a GitHub URL/repo/local-repo is currently loaded. */
export interface DesktopCurrentGitHubState {
  hasCurrentUrl: boolean;
  hasCurrentRepository: boolean;
  hasCurrentLocalRepository: boolean;
}

/** Result payload returned after a successful repository clone. */
export interface DesktopCloneRepositoryResult {
  repositoryUrl: string;
  destinationPath: string;
  openedDestination: boolean;
  openDestinationError?: string;
}

/** Existence and path info for a local repository on disk. */
export interface DesktopLocalRepositoryStatus {
  repositoryUrl: string;
  path?: string;
  exists: boolean;
}

/** Info about a specific path inside a local repository. */
export interface DesktopLocalRepositoryPathStatus {
  repositoryUrl: string;
  repositoryPath?: string;
  relativePath: string;
  path?: string;
  exists: boolean;
  isDirectory: boolean;
}

/** Comprehensive git status snapshot for a local repository. */
export interface DesktopLocalRepositoryGitStatus {
  repositoryUrl: string;
  repositoryPath: string;
  branch?: string;
  upstream?: string;
  lastCommit?: DesktopLocalRepositoryGitCommit | null;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
  clean: boolean;
}

/** Lists of local and remote branches for a repository. */
export interface DesktopLocalRepositoryBranches {
  repositoryUrl: string;
  repositoryPath: string;
  currentBranch?: string | null;
  branches: DesktopLocalRepositoryBranch[];
  remoteBranches: DesktopLocalRepositoryRemoteBranch[];
}

/** A single local branch with its upstream tracking ref. */
export interface DesktopLocalRepositoryBranch {
  name: string;
  upstream?: string | null;
  current: boolean;
}

/** A remote branch and whether it can be checked out locally. */
export interface DesktopLocalRepositoryRemoteBranch {
  name: string;
  localName: string;
  checkoutable: boolean;
}

/** Collection of files changed in the working tree or index. */
export interface DesktopLocalRepositoryChangedFiles {
  repositoryUrl: string;
  repositoryPath: string;
  files: DesktopLocalRepositoryChangedFile[];
}

/** A single changed file with its git status flags. */
export interface DesktopLocalRepositoryChangedFile {
  path: string;
  previousPath?: string | null;
  status: string;
  statusKind: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  conflicted: boolean;
  openable: boolean;
}

/** Per-file diff output split by staged/unstaged/untracked. */
export interface DesktopLocalRepositoryFileDiff {
  repositoryUrl: string;
  repositoryPath: string;
  path: string;
  previousPath?: string | null;
  stagedDiff: string;
  unstagedDiff: string;
  untrackedDiff: string;
  truncated: boolean;
  empty: boolean;
}

/** A single commit entry in the local repository history. */
export interface DesktopLocalRepositoryGitCommit {
  oid: string;
  shortOid: string;
  authorName: string;
  authorEmail: string;
  authoredAt: number;
  summary: string;
}

/** Paginated commit history for a local repository. */
export interface DesktopLocalRepositoryCommitHistory {
  repositoryUrl: string;
  repositoryPath: string;
  commits: DesktopLocalRepositoryGitCommit[];
}
