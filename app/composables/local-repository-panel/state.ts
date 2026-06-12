import { ref } from 'vue';

import type {
  DesktopLocalRepositoryBranches,
  DesktopLocalRepositoryChangedFiles,
  DesktopLocalRepositoryCommitHistory,
  DesktopLocalRepositoryFileDiff,
  DesktopLocalRepositoryGitStatus,
  DesktopLocalRepositoryStatus,
} from '~/composables/useDesktopRuntime';

import type { DesktopRepositoryAction } from './types';

/** Create a monotonic serial counter to guard against stale async responses. */
const createRequestSerial = () => {
  let value = 0;

  return {
    cancel: () => {
      value += 1;
    },
    isCurrent: (requestId: number) => requestId === value,
    next: () => {
      value += 1;
      return value;
    },
  };
};

/** All reactive refs and reset helpers for the local repository panel. */
export const useLocalRepositoryPanelState = () => {
  const desktopLocalRepositoryStatus = ref<DesktopLocalRepositoryStatus | null>(null);
  const desktopLocalRepositoryGitStatus = ref<DesktopLocalRepositoryGitStatus | null>(null);
  const desktopLocalRepositoryBranches = ref<DesktopLocalRepositoryBranches | null>(null);
  const desktopLocalRepositoryCommitHistory = ref<DesktopLocalRepositoryCommitHistory | null>(null);
  const desktopLocalRepositoryChangedFiles = ref<DesktopLocalRepositoryChangedFiles | null>(null);
  const desktopLocalRepositoryFileDiff = ref<DesktopLocalRepositoryFileDiff | null>(null);
  const desktopStatusLoading = ref(false);
  const desktopStatusError = ref('');
  const desktopGitStatusLoading = ref(false);
  const desktopGitStatusError = ref('');
  const desktopBranchesLoading = ref(false);
  const desktopBranchesError = ref('');
  const desktopCommitHistoryLoading = ref(false);
  const desktopCommitHistoryError = ref('');
  const desktopChangedFilesLoading = ref(false);
  const desktopChangedFilesError = ref('');
  const desktopFileDiffLoading = ref(false);
  const desktopFileDiffError = ref('');
  const desktopSelectedChangedFilePath = ref('');
  const desktopAction = ref<DesktopRepositoryAction>(null);
  const desktopBranchAction = ref(false);
  const desktopNewBranchName = ref('');
  const desktopRemoteBranchName = ref('');
  const desktopCreateBranchLoading = ref(false);
  const desktopCheckoutRemoteBranchLoading = ref(false);
  const desktopCommitMessage = ref('');
  const desktopCloneCopied = ref(false);
  const requestSerials = {
    branches: createRequestSerial(),
    changedFiles: createRequestSerial(),
    commitHistory: createRequestSerial(),
    fileDiff: createRequestSerial(),
    gitStatus: createRequestSerial(),
    status: createRequestSerial(),
  };

  const resetDesktopLocalRepositoryGitStatus = () => {
    requestSerials.gitStatus.cancel();
    desktopLocalRepositoryGitStatus.value = null;
    desktopGitStatusLoading.value = false;
    desktopGitStatusError.value = '';
  };

  const resetDesktopLocalRepositoryBranches = () => {
    requestSerials.branches.cancel();
    desktopLocalRepositoryBranches.value = null;
    desktopBranchesLoading.value = false;
    desktopBranchesError.value = '';
  };

  const resetDesktopLocalRepositoryCommitHistory = () => {
    requestSerials.commitHistory.cancel();
    desktopLocalRepositoryCommitHistory.value = null;
    desktopCommitHistoryLoading.value = false;
    desktopCommitHistoryError.value = '';
  };

  const resetDesktopLocalRepositoryFileDiff = () => {
    requestSerials.fileDiff.cancel();
    desktopLocalRepositoryFileDiff.value = null;
    desktopFileDiffLoading.value = false;
    desktopFileDiffError.value = '';
    desktopSelectedChangedFilePath.value = '';
  };

  const resetDesktopLocalRepositoryChangedFiles = () => {
    requestSerials.changedFiles.cancel();
    desktopLocalRepositoryChangedFiles.value = null;
    desktopChangedFilesLoading.value = false;
    desktopChangedFilesError.value = '';
    resetDesktopLocalRepositoryFileDiff();
  };

  return {
    desktopAction,
    desktopBranchAction,
    desktopBranchesError,
    desktopBranchesLoading,
    desktopChangedFilesError,
    desktopChangedFilesLoading,
    desktopCheckoutRemoteBranchLoading,
    desktopCloneCopied,
    desktopCommitHistoryError,
    desktopCommitHistoryLoading,
    desktopCommitMessage,
    desktopCreateBranchLoading,
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
    desktopNewBranchName,
    desktopRemoteBranchName,
    desktopSelectedChangedFilePath,
    desktopStatusError,
    desktopStatusLoading,
    requestSerials,
    resetDesktopLocalRepositoryBranches,
    resetDesktopLocalRepositoryChangedFiles,
    resetDesktopLocalRepositoryCommitHistory,
    resetDesktopLocalRepositoryFileDiff,
    resetDesktopLocalRepositoryGitStatus,
  };
};

/** Type alias exposing the reactive refs returned by the panel state composable. */
export type LocalRepositoryPanelStateRefs = ReturnType<typeof useLocalRepositoryPanelState>;
