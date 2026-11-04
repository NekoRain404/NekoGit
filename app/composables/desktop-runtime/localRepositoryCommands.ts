/// Desktop command wrappers for local git repository operations (clone, status, branches, diffs, commits, pull/push).
import { invokeDesktopCommand } from './invoke';
import type {
  DesktopCloneRepositoryResult,
  DesktopLocalRepositoryBranches,
  DesktopLocalRepositoryChangedFiles,
  DesktopLocalRepositoryCommitHistory,
  DesktopLocalRepositoryFileDiff,
  DesktopLocalRepositoryGitStatus,
  DesktopLocalRepositoryPathStatus,
  DesktopLocalRepositoryStatus,
} from './types';

/** Clone a remote repository into a local directory. */
export const cloneRepository = async (repositoryUrl: string, destinationDirectory: string) => {
  return invokeDesktopCommand<DesktopCloneRepositoryResult>('desktop_clone_repository', {
    repositoryUrl,
    destinationDirectory,
  });
};

/** Associate an existing local Git clone with the current GitHub repository. */
export const rememberLocalRepository = async (repositoryUrl: string, directory: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryStatus>('desktop_remember_local_repository', {
    repositoryUrl,
    directory,
  });
};

/** Check whether a local repository exists on disk. */
export const getLocalRepositoryStatus = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryStatus>('desktop_local_repository_status', {
    repositoryUrl,
  });
};

/** Retrieve git working-tree status (branch, ahead/behind, staged, etc.). */
export const getLocalRepositoryGitStatus = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>(
    'desktop_local_repository_git_status',
    {
      repositoryUrl,
    }
  );
};

/** List local and remote branches for a repository. */
export const getLocalRepositoryBranches = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryBranches>('desktop_local_repository_branches', {
    repositoryUrl,
  });
};

/** Fetch recent commit history for a repository. */
export const getLocalRepositoryCommitHistory = async (repositoryUrl: string, limit = 6) => {
  return invokeDesktopCommand<DesktopLocalRepositoryCommitHistory>(
    'desktop_local_repository_commit_history',
    {
      repositoryUrl,
      limit,
    }
  );
};

/** List recently changed files across the working tree and index. */
export const getLocalRepositoryChangedFiles = async (repositoryUrl: string, limit = 8) => {
  return invokeDesktopCommand<DesktopLocalRepositoryChangedFiles>(
    'desktop_local_repository_changed_files',
    {
      repositoryUrl,
      limit,
    }
  );
};

/** Retrieve the staged/unstaged/untracked diff for a single file. */
export const getLocalRepositoryFileDiff = async (
  repositoryUrl: string,
  relativePath: string,
  previousPath?: string | null,
  maxBytes = 120_000
) => {
  return invokeDesktopCommand<DesktopLocalRepositoryFileDiff>(
    'desktop_local_repository_file_diff',
    {
      repositoryUrl,
      relativePath,
      previousPath: previousPath ?? null,
      maxBytes,
    }
  );
};

/** Run `git fetch` on a local repository. */
export const fetchLocalRepository = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>('desktop_fetch_local_repository', {
    repositoryUrl,
  });
};

/** Run `git pull` on a local repository. */
export const pullLocalRepository = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>('desktop_pull_local_repository', {
    repositoryUrl,
  });
};

/** Run `git push` on a local repository. */
export const pushLocalRepository = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>('desktop_push_local_repository', {
    repositoryUrl,
  });
};

/** Switch the checked-out branch of a local repository. */
export const switchLocalRepositoryBranch = async (repositoryUrl: string, branchName: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>(
    'desktop_switch_local_repository_branch',
    {
      repositoryUrl,
      branchName,
    }
  );
};

/** Create a new local branch in a repository. */
export const createLocalRepositoryBranch = async (repositoryUrl: string, branchName: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>(
    'desktop_create_local_repository_branch',
    {
      repositoryUrl,
      branchName,
    }
  );
};

/** Check out a remote branch as a new local tracking branch. */
export const checkoutRemoteLocalRepositoryBranch = async (
  repositoryUrl: string,
  remoteBranchName: string
) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>(
    'desktop_checkout_remote_local_repository_branch',
    {
      repositoryUrl,
      remoteBranchName,
    }
  );
};

/** Stage all changes and commit with the given message. */
export const commitLocalRepositoryChanges = async (
  repositoryUrl: string,
  commitMessage: string
) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>(
    'desktop_commit_local_repository_changes',
    {
      repositoryUrl,
      commitMessage,
    }
  );
};

/** Stash all current working-tree changes. */
export const stashLocalRepositoryChanges = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryGitStatus>(
    'desktop_stash_local_repository_changes',
    {
      repositoryUrl,
    }
  );
};

/** Reveal a local repository in the system file manager. */
export const openLocalRepository = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryStatus>('desktop_open_local_repository', {
    repositoryUrl,
  });
};

/** Open a terminal session rooted at the repository directory. */
export const openLocalRepositoryTerminal = async (repositoryUrl: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryStatus>(
    'desktop_open_local_repository_terminal',
    {
      repositoryUrl,
    }
  );
};

/** Open a specific file or directory inside a local repository. */
export const openLocalRepositoryPath = async (repositoryUrl: string, relativePath: string) => {
  return invokeDesktopCommand<DesktopLocalRepositoryPathStatus>(
    'desktop_open_local_repository_path',
    {
      repositoryUrl,
      relativePath,
    }
  );
};
