import type { ComputedRef } from 'vue';

import type {
  DesktopLocalRepositoryBranches,
  DesktopLocalRepositoryChangedFile,
  DesktopLocalRepositoryChangedFiles,
  DesktopLocalRepositoryCommitHistory,
  DesktopLocalRepositoryFileDiff,
  DesktopLocalRepositoryGitStatus,
  DesktopLocalRepositoryStatus,
} from '~/composables/useDesktopRuntime';
import type { CurrentGitHubRepository } from '~/utils/current-github-url-utils';

import { getDesktopActionErrorMessage } from './desktopDialogs';
import type { LocalRepositoryPanelStateRefs } from './state';
import type { LocalRepositoryCopy } from './types';

type LocalRepositoryPanelRefreshCommands = {
  getLocalRepositoryBranches: (repositoryUrl: string) => Promise<DesktopLocalRepositoryBranches>;
  getLocalRepositoryChangedFiles: (
    repositoryUrl: string,
    limit?: number
  ) => Promise<DesktopLocalRepositoryChangedFiles>;
  getLocalRepositoryCommitHistory: (
    repositoryUrl: string,
    limit?: number
  ) => Promise<DesktopLocalRepositoryCommitHistory>;
  getLocalRepositoryFileDiff: (
    repositoryUrl: string,
    relativePath: string,
    previousPath?: string | null,
    maxBytes?: number
  ) => Promise<DesktopLocalRepositoryFileDiff>;
  getLocalRepositoryGitStatus: (repositoryUrl: string) => Promise<DesktopLocalRepositoryGitStatus>;
  getLocalRepositoryStatus: (repositoryUrl: string) => Promise<DesktopLocalRepositoryStatus>;
};

type LocalRepositoryPanelRefreshersOptions = {
  commands: LocalRepositoryPanelRefreshCommands;
  copy: ComputedRef<LocalRepositoryCopy>;
  desktopAvailable: ComputedRef<boolean>;
  desktopRepository: ComputedRef<CurrentGitHubRepository | null>;
  state: LocalRepositoryPanelStateRefs;
};

/** Async refresh helpers for every section of the local repository panel. */
export const useLocalRepositoryPanelRefreshers = ({
  commands,
  copy,
  desktopAvailable,
  desktopRepository,
  state,
}: LocalRepositoryPanelRefreshersOptions) => {
  const {
    desktopBranchesError,
    desktopBranchesLoading,
    desktopChangedFilesError,
    desktopChangedFilesLoading,
    desktopCommitHistoryError,
    desktopCommitHistoryLoading,
    desktopFileDiffError,
    desktopFileDiffLoading,
    desktopGitStatusError,
    desktopGitStatusLoading,
    desktopLocalRepositoryBranches,
    desktopLocalRepositoryChangedFiles,
    desktopLocalRepositoryCommitHistory,
    desktopLocalRepositoryFileDiff,
    desktopLocalRepositoryGitStatus,
    desktopLocalRepositoryStatus,
    desktopSelectedChangedFilePath,
    desktopStatusError,
    desktopStatusLoading,
    requestSerials,
    resetDesktopLocalRepositoryBranches,
    resetDesktopLocalRepositoryChangedFiles,
    resetDesktopLocalRepositoryCommitHistory,
    resetDesktopLocalRepositoryFileDiff,
    resetDesktopLocalRepositoryGitStatus,
  } = state;

  const resetDesktopLocalRepositoryReadState = () => {
    resetDesktopLocalRepositoryGitStatus();
    resetDesktopLocalRepositoryBranches();
    resetDesktopLocalRepositoryChangedFiles();
    resetDesktopLocalRepositoryCommitHistory();
  };

  const refreshDesktopLocalRepositoryGitStatus = async () => {
    const repository = desktopRepository.value;
    if (!repository || !desktopAvailable.value || !desktopLocalRepositoryStatus.value?.exists) {
      resetDesktopLocalRepositoryGitStatus();
      return null;
    }

    const requestId = requestSerials.gitStatus.next();
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      const status = await commands.getLocalRepositoryGitStatus(repository.cloneUrl);
      if (!requestSerials.gitStatus.isCurrent(requestId)) return status;

      desktopLocalRepositoryGitStatus.value = status;
      return status;
    } catch (error) {
      if (requestSerials.gitStatus.isCurrent(requestId)) {
        desktopLocalRepositoryGitStatus.value = null;
        desktopGitStatusError.value = getDesktopActionErrorMessage(
          error,
          copy.value.localGitUnavailable
        );
      }
      return null;
    } finally {
      if (requestSerials.gitStatus.isCurrent(requestId)) {
        desktopGitStatusLoading.value = false;
      }
    }
  };

  const refreshDesktopLocalRepositoryBranches = async () => {
    const repository = desktopRepository.value;
    if (!repository || !desktopAvailable.value || !desktopLocalRepositoryStatus.value?.exists) {
      resetDesktopLocalRepositoryBranches();
      return null;
    }

    const requestId = requestSerials.branches.next();
    desktopBranchesLoading.value = true;
    desktopBranchesError.value = '';

    try {
      const branches = await commands.getLocalRepositoryBranches(repository.cloneUrl);
      if (!requestSerials.branches.isCurrent(requestId)) return branches;

      desktopLocalRepositoryBranches.value = branches;
      return branches;
    } catch (error) {
      if (requestSerials.branches.isCurrent(requestId)) {
        desktopLocalRepositoryBranches.value = null;
        desktopBranchesError.value = getDesktopActionErrorMessage(
          error,
          copy.value.gitBranchesUnavailable
        );
      }
      return null;
    } finally {
      if (requestSerials.branches.isCurrent(requestId)) {
        desktopBranchesLoading.value = false;
      }
    }
  };

  const previewDesktopChangedFileDiff = async (file: DesktopLocalRepositoryChangedFile) => {
    const repository = desktopRepository.value;
    if (!repository || !desktopAvailable.value || !desktopLocalRepositoryStatus.value?.exists) {
      resetDesktopLocalRepositoryFileDiff();
      return null;
    }

    const requestId = requestSerials.fileDiff.next();
    desktopSelectedChangedFilePath.value = file.path;
    desktopLocalRepositoryFileDiff.value = null;
    desktopFileDiffLoading.value = true;
    desktopFileDiffError.value = '';

    try {
      const diff = await commands.getLocalRepositoryFileDiff(
        repository.cloneUrl,
        file.path,
        file.previousPath,
        120_000
      );
      if (!requestSerials.fileDiff.isCurrent(requestId)) return diff;

      desktopLocalRepositoryFileDiff.value = diff;
      return diff;
    } catch (error) {
      if (requestSerials.fileDiff.isCurrent(requestId)) {
        desktopLocalRepositoryFileDiff.value = null;
        desktopFileDiffError.value = getDesktopActionErrorMessage(
          error,
          copy.value.localDiffUnavailable
        );
      }
      return null;
    } finally {
      if (requestSerials.fileDiff.isCurrent(requestId)) {
        desktopFileDiffLoading.value = false;
      }
    }
  };

  const refreshDesktopLocalRepositoryChangedFiles = async () => {
    const repository = desktopRepository.value;
    if (!repository || !desktopAvailable.value || !desktopLocalRepositoryStatus.value?.exists) {
      resetDesktopLocalRepositoryChangedFiles();
      return null;
    }

    const requestId = requestSerials.changedFiles.next();
    desktopChangedFilesLoading.value = true;
    desktopChangedFilesError.value = '';

    try {
      const changedFiles = await commands.getLocalRepositoryChangedFiles(repository.cloneUrl, 8);
      if (!requestSerials.changedFiles.isCurrent(requestId)) return changedFiles;

      desktopLocalRepositoryChangedFiles.value = changedFiles;
      const selectedFile =
        changedFiles.files.find((file) => file.path === desktopSelectedChangedFilePath.value) ??
        changedFiles.files[0];
      if (selectedFile) {
        void previewDesktopChangedFileDiff(selectedFile);
      } else {
        resetDesktopLocalRepositoryFileDiff();
      }
      return changedFiles;
    } catch (error) {
      if (requestSerials.changedFiles.isCurrent(requestId)) {
        desktopLocalRepositoryChangedFiles.value = null;
        resetDesktopLocalRepositoryFileDiff();
        desktopChangedFilesError.value = getDesktopActionErrorMessage(
          error,
          copy.value.localChangesUnavailable
        );
      }
      return null;
    } finally {
      if (requestSerials.changedFiles.isCurrent(requestId)) {
        desktopChangedFilesLoading.value = false;
      }
    }
  };

  const refreshDesktopLocalRepositoryCommitHistory = async () => {
    const repository = desktopRepository.value;
    if (!repository || !desktopAvailable.value || !desktopLocalRepositoryStatus.value?.exists) {
      resetDesktopLocalRepositoryCommitHistory();
      return null;
    }

    const requestId = requestSerials.commitHistory.next();
    desktopCommitHistoryLoading.value = true;
    desktopCommitHistoryError.value = '';

    try {
      const history = await commands.getLocalRepositoryCommitHistory(repository.cloneUrl, 6);
      if (!requestSerials.commitHistory.isCurrent(requestId)) return history;

      desktopLocalRepositoryCommitHistory.value = history;
      return history;
    } catch (error) {
      if (requestSerials.commitHistory.isCurrent(requestId)) {
        desktopLocalRepositoryCommitHistory.value = null;
        desktopCommitHistoryError.value = getDesktopActionErrorMessage(
          error,
          copy.value.localHistoryUnavailable
        );
      }
      return null;
    } finally {
      if (requestSerials.commitHistory.isCurrent(requestId)) {
        desktopCommitHistoryLoading.value = false;
      }
    }
  };

  const refreshDesktopLocalRepositoryStatus = async () => {
    const repository = desktopRepository.value;
    if (!repository || !desktopAvailable.value) {
      desktopLocalRepositoryStatus.value = null;
      desktopStatusError.value = '';
      resetDesktopLocalRepositoryReadState();
      return null;
    }

    const requestId = requestSerials.status.next();
    desktopStatusLoading.value = true;
    desktopStatusError.value = '';

    try {
      const status = await commands.getLocalRepositoryStatus(repository.cloneUrl);
      if (!requestSerials.status.isCurrent(requestId)) return status;

      desktopLocalRepositoryStatus.value = status;
      if (status.exists) {
        void refreshDesktopLocalRepositoryGitStatus();
        void refreshDesktopLocalRepositoryBranches();
        void refreshDesktopLocalRepositoryChangedFiles();
        void refreshDesktopLocalRepositoryCommitHistory();
      } else {
        resetDesktopLocalRepositoryReadState();
      }
      return status;
    } catch (error) {
      if (requestSerials.status.isCurrent(requestId)) {
        desktopLocalRepositoryStatus.value = null;
        desktopStatusError.value = getDesktopActionErrorMessage(
          error,
          'Unable to inspect local repository.'
        );
        resetDesktopLocalRepositoryReadState();
      }
      return null;
    } finally {
      if (requestSerials.status.isCurrent(requestId)) {
        desktopStatusLoading.value = false;
      }
    }
  };

  return {
    previewDesktopChangedFileDiff,
    refreshDesktopLocalRepositoryBranches,
    refreshDesktopLocalRepositoryChangedFiles,
    refreshDesktopLocalRepositoryCommitHistory,
    refreshDesktopLocalRepositoryGitStatus,
    refreshDesktopLocalRepositoryReadState: resetDesktopLocalRepositoryReadState,
    refreshDesktopLocalRepositoryStatus,
  };
};
