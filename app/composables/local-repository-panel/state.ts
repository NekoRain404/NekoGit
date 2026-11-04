/// Central reactive state, request serials, and reset helpers for the local repository panel.
import { ref, shallowRef } from 'vue';

import type {
  DesktopLocalRepositoryBranches,
  DesktopLocalRepositoryChangedFiles,
  DesktopLocalRepositoryCommitHistory,
  DesktopLocalRepositoryFileDiff,
  DesktopLocalRepositoryGitStatus,
  DesktopLocalRepositoryStashes,
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
  const desktopLocalRepositoryStashes = ref<DesktopLocalRepositoryStashes | null>(null);
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
  const desktopChangedFileActionError = ref('');
  const desktopStagingChangedFilePaths = ref<Record<string, boolean>>({});
  const desktopUnstagingChangedFilePaths = ref<Record<string, boolean>>({});
  const desktopStashesLoading = ref(false);
  const desktopStashesError = ref('');
  const desktopStashPoppingIndex = ref<number | null>(null);
  const desktopFileDiffLoading = ref(false);
  const desktopFileDiffError = ref('');
  const desktopSelectedChangedFilePath = ref('');
  const desktopAction = ref<DesktopRepositoryAction>(null);
  const desktopBranchAction = ref(false);
  const desktopNewBranchName = ref('');
  const desktopRemoteBranchName = ref('');
  const desktopCreateBranchLoading = ref(false);
  const desktopCheckoutRemoteBranchLoading = ref(false);
  const desktopBranchToDelete = ref('');
  const desktopDeleteBranchLoading = ref(false);
  const desktopCommitMessage = ref('');
  const desktopCloneCopied = ref(false);
  const associatedPullRequest = shallowRef<{
    number: number;
    title: string;
    state: string;
    html_url: string;
  } | null>(null);
  const prLoading = shallowRef(false);
  const createPullRequestTitle = ref('');
  const createPullRequestBody = ref('');
  const createPullRequestBaseBranch = ref('');
  const requestSerials = {
    branches: createRequestSerial(),
    changedFiles: createRequestSerial(),
    commitHistory: createRequestSerial(),
    fileDiff: createRequestSerial(),
    gitStatus: createRequestSerial(),
    stashes: createRequestSerial(),
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
    desktopChangedFileActionError.value = '';
    desktopStagingChangedFilePaths.value = {};
    desktopUnstagingChangedFilePaths.value = {};
    resetDesktopLocalRepositoryFileDiff();
  };

  const resetDesktopLocalRepositoryStashes = () => {
    requestSerials.stashes.cancel();
    desktopLocalRepositoryStashes.value = null;
    desktopStashesLoading.value = false;
    desktopStashesError.value = '';
    desktopStashPoppingIndex.value = null;
  };

  return {
    desktopAction,
    desktopBranchAction,
    desktopBranchToDelete,
    desktopBranchesError,
    desktopBranchesLoading,
    desktopChangedFileActionError,
    desktopChangedFilesError,
    desktopChangedFilesLoading,
    desktopCheckoutRemoteBranchLoading,
    desktopCloneCopied,
    associatedPullRequest,
    prLoading,
    createPullRequestTitle,
    createPullRequestBody,
    createPullRequestBaseBranch,
    desktopCommitHistoryError,
    desktopCommitHistoryLoading,
    desktopCommitMessage,
    desktopCreateBranchLoading,
    desktopDeleteBranchLoading,
    desktopFileDiffError,
    desktopFileDiffLoading,
    desktopGitStatusError,
    desktopGitStatusLoading,
    desktopLocalRepositoryBranches,
    desktopLocalRepositoryChangedFiles,
    desktopLocalRepositoryCommitHistory,
    desktopLocalRepositoryFileDiff,
    desktopLocalRepositoryGitStatus,
    desktopLocalRepositoryStashes,
    desktopLocalRepositoryStatus,
    desktopNewBranchName,
    desktopRemoteBranchName,
    desktopSelectedChangedFilePath,
    desktopStagingChangedFilePaths,
    desktopStashPoppingIndex,
    desktopStashesError,
    desktopStashesLoading,
    desktopStatusError,
    desktopStatusLoading,
    desktopUnstagingChangedFilePaths,
    requestSerials,
    resetDesktopLocalRepositoryBranches,
    resetDesktopLocalRepositoryChangedFiles,
    resetDesktopLocalRepositoryCommitHistory,
    resetDesktopLocalRepositoryFileDiff,
    resetDesktopLocalRepositoryGitStatus,
    resetDesktopLocalRepositoryStashes,
  };
};

/** Type alias exposing the reactive refs returned by the panel state composable. */
export type LocalRepositoryPanelStateRefs = ReturnType<typeof useLocalRepositoryPanelState>;
