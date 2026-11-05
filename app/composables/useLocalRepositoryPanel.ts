/// Full-featured local repository panel: status, branches, commits, diffs, clone, and git actions.
import { computed, onMounted, onUnmounted, watch } from 'vue';

import type {
  DesktopLocalRepositoryChangedFile,
  DesktopLocalRepositoryGitStatus,
} from '~/composables/useDesktopRuntime';
import { buildCurrentGitHubRepository } from '~/utils/current-github-url-utils';

import {
  chooseCloneDestinationDirectory,
  chooseExistingLocalRepositoryDirectory,
  getDesktopActionErrorMessage,
  showDesktopMessage,
} from './local-repository-panel/desktopDialogs';
import { useLocalRepositoryPanelRefreshers } from './local-repository-panel/refreshers';
import { useLocalRepositoryPanelState } from './local-repository-panel/state';
import type {
  DesktopRepositoryGitAction,
  UseLocalRepositoryPanelOptions,
} from './local-repository-panel/types';
import { useLocalRepositoryPanelViewModel } from './local-repository-panel/viewModel';

export type { LocalRepositoryCopy } from './local-repository-panel/types';

/** Full-featured local repository panel: status, branches, commits, diff, clone, and git actions. */
export function useLocalRepositoryPanel(options: UseLocalRepositoryPanelOptions) {
  const {
    amendLocalRepositoryCommit,
    available: desktopAvailable,
    cancelLocalRepositoryOperation,
    checkoutRemoteLocalRepositoryBranch,
    cloneRepository,
    commitLocalRepositoryChanges,
    createLocalRepositoryBranch,
    deleteLocalRepositoryBranch,
    fetchLocalRepository,
    getLocalRepositoryBranches,
    getLocalRepositoryChangedFiles,
    getLocalRepositoryCommitHistory,
    getLocalRepositoryFileDiff,
    getLocalRepositoryGitStatus,
    getLocalRepositoryStashes,
    getLocalRepositoryStatus,
    loadRuntimeInfo,
    openLocalRepository,
    openLocalRepositoryPath,
    openLocalRepositoryTerminal,
    applyLocalRepositoryStash,
    clearLocalRepositoryStashes,
    popLocalRepositoryStash,
    pullLocalRepository,
    pushLocalRepository,
    rebaseDesktopLocalRepository: rebaseLocalRepositoryCommand,
    abortDesktopLocalRepositoryRebase: abortLocalRepositoryRebaseCommand,
    rememberLocalRepository,
    stageLocalRepositoryPath,
    stashLocalRepositoryChanges,
    switchLocalRepositoryBranch,
    undoLocalRepositoryCommit,
    unstageLocalRepositoryPath,
  } = useDesktopRuntime();
  const { writeClipboardText } = useClipboardWriter();

  const panelState = useLocalRepositoryPanelState();
  const {
    desktopAbortRebaseLoading,
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
    desktopRebaseLoading,
    desktopRemoteBranchName,
    desktopSelectedChangedFilePath,
    desktopStagingChangedFilePaths,
    desktopStashActionError,
    desktopStashApplyingIndex,
    desktopStashClearing,
    desktopStashPoppingIndex,
    desktopStashesError,
    desktopStashesLoading,
    desktopStatusError,
    desktopStatusLoading,
    desktopUnstagingChangedFilePaths,
    associatedPullRequest,
    prLoading,
    createPullRequestTitle,
    createPullRequestBody,
    createPullRequestBaseBranch,
  } = panelState;
  let desktopCloneCopiedTimer: ReturnType<typeof setTimeout> | undefined;

  const desktopRepository = computed(() =>
    buildCurrentGitHubRepository(options.owner.value, options.repo.value)
  );
  const desktopCloneUrl = computed(() => desktopRepository.value?.cloneUrl ?? '');
  const {
    desktopCanAmendCommit,
    desktopCanCommitChanges,
    desktopCanStashChanges,
    desktopCanUndoCommit,
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
  } = useLocalRepositoryPanelViewModel({
    ...options,
    desktopAction,
    desktopCloneUrl,
    desktopCommitMessage,
    desktopGitStatusError,
    desktopGitStatusLoading,
    desktopLocalRepositoryBranches,
    desktopLocalRepositoryChangedFiles,
    desktopLocalRepositoryCommitHistory,
    desktopLocalRepositoryFileDiff,
    desktopLocalRepositoryGitStatus,
    desktopLocalRepositoryStatus,
    desktopStatusError,
    desktopStatusLoading,
  });

  const {
    changedFilesExpanded,
    commitHistoryExpanded,
    previewDesktopChangedFileDiff,
    refreshAssociatedPullRequest,
    refreshDesktopLocalRepositoryBranches,
    refreshDesktopLocalRepositoryChangedFiles,
    refreshDesktopLocalRepositoryCommitHistory,
    refreshDesktopLocalRepositoryGitStatus,
    refreshDesktopLocalRepositoryReadState,
    refreshDesktopLocalRepositoryStashes,
    refreshDesktopLocalRepositoryStatus,
    resetDesktopLocalRepositoryListLimits,
    showAllDesktopChangedFiles,
    showAllDesktopCommitHistory,
  } = useLocalRepositoryPanelRefreshers({
    commands: {
      getLocalRepositoryBranches,
      getLocalRepositoryChangedFiles,
      getLocalRepositoryCommitHistory,
      getLocalRepositoryFileDiff,
      getLocalRepositoryGitStatus,
      getLocalRepositoryStashes,
      getLocalRepositoryStatus,
    },
    copy: options.copy,
    desktopAvailable,
    desktopRepository,
    state: panelState,
  });

  const cloneDesktopRepository = async () => {
    const repository = desktopRepository.value;
    if (!repository || desktopAction.value) return;

    desktopAction.value = 'clone';
    try {
      const destinationDirectory = await chooseCloneDestinationDirectory(repository.fullName);
      if (typeof destinationDirectory !== 'string') return;

      const result = await cloneRepository(repository.cloneUrl, destinationDirectory);
      desktopLocalRepositoryStatus.value = {
        repositoryUrl: result.repositoryUrl,
        path: result.destinationPath,
        exists: true,
      };
      desktopStatusError.value = '';

      await showDesktopMessage(`${repository.fullName}\n${result.destinationPath}`, 'info');
      await refreshDesktopLocalRepositoryStatus();
      await refreshDesktopLocalRepositoryGitStatus();
      await refreshDesktopLocalRepositoryBranches();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      const message = getDesktopActionErrorMessage(error, 'Failed to clone repository.');
      await showDesktopMessage(message, 'error');
    } finally {
      desktopAction.value = null;
    }
  };

  const cancelDesktopLocalRepositoryOperation = async () => {
    try {
      await cancelLocalRepositoryOperation();
    } catch (error) {
      const message = getDesktopActionErrorMessage(error, 'Failed to cancel the Git operation.');
      await showDesktopMessage(message, 'error');
    }
  };

  const adoptDesktopLocalRepository = async () => {
    const repository = desktopRepository.value;
    if (!repository || desktopAction.value) return;

    desktopAction.value = 'adopt';
    try {
      const directory = await chooseExistingLocalRepositoryDirectory(repository.fullName);
      if (typeof directory !== 'string') return;

      desktopLocalRepositoryStatus.value = await rememberLocalRepository(
        repository.cloneUrl,
        directory
      );
      await refreshDesktopLocalRepositoryStatus();
      await refreshDesktopLocalRepositoryGitStatus();
      await refreshDesktopLocalRepositoryBranches();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      const message = getDesktopActionErrorMessage(error, 'Failed to adopt local repository.');
      await showDesktopMessage(message, 'error');
    } finally {
      desktopAction.value = null;
    }
  };

  const openDesktopLocalRepository = async () => {
    const repository = desktopRepository.value;
    if (!repository || !desktopLocalRepositoryStatus.value?.exists || desktopAction.value) return;

    desktopAction.value = 'open';
    try {
      desktopLocalRepositoryStatus.value = await openLocalRepository(repository.cloneUrl);
      desktopStatusError.value = '';
      await refreshDesktopLocalRepositoryGitStatus();
      await refreshDesktopLocalRepositoryBranches();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopLocalRepositoryStatus.value = null;
      desktopStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to open local repository.'
      );
      refreshDesktopLocalRepositoryReadState();
      await showDesktopMessage(desktopStatusError.value, 'error');
    } finally {
      desktopAction.value = null;
    }
  };

  const openDesktopLocalRepositoryTerminal = async () => {
    const repository = desktopRepository.value;
    if (!repository || !desktopLocalRepositoryStatus.value?.exists || desktopAction.value) return;

    desktopAction.value = 'terminal';
    try {
      desktopLocalRepositoryStatus.value = await openLocalRepositoryTerminal(repository.cloneUrl);
      desktopStatusError.value = '';
    } catch (error) {
      const message = getDesktopActionErrorMessage(error, 'Failed to open terminal.');
      await showDesktopMessage(message, 'error');
    } finally {
      desktopAction.value = null;
    }
  };

  const runDesktopLocalRepositoryGitAction = async (
    action: DesktopRepositoryGitAction,
    command: (repositoryUrl: string) => Promise<DesktopLocalRepositoryGitStatus>,
    fallbackError: string,
    confirmMessage?: string
  ) => {
    const repository = desktopRepository.value;
    if (!repository || !desktopLocalRepositoryStatus.value?.exists || desktopAction.value) return;
    if (confirmMessage && import.meta.client && !window.confirm(confirmMessage)) return;

    desktopAction.value = action;
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await command(repository.cloneUrl);
      void refreshAssociatedPullRequest();
      void refreshDesktopLocalRepositoryBranches();
      void refreshDesktopLocalRepositoryChangedFiles();
      void refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(error, fallbackError);
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopAction.value = null;
    }
  };

  const fetchDesktopLocalRepository = async () => {
    await runDesktopLocalRepositoryGitAction(
      'fetch',
      fetchLocalRepository,
      'Failed to fetch local repository.'
    );
  };

  const pullDesktopLocalRepository = async () => {
    await runDesktopLocalRepositoryGitAction(
      'pull',
      pullLocalRepository,
      'Failed to pull local repository.'
    );
  };

  const pushDesktopLocalRepository = async () => {
    await runDesktopLocalRepositoryGitAction(
      'push',
      pushLocalRepository,
      'Failed to push local repository.',
      options.copy.value.confirmPush
    );
  };

  const refreshAfterRebase = async () => {
    void refreshAssociatedPullRequest();
    await Promise.all([
      refreshDesktopLocalRepositoryGitStatus(),
      refreshDesktopLocalRepositoryBranches(),
      refreshDesktopLocalRepositoryChangedFiles(),
      refreshDesktopLocalRepositoryCommitHistory(),
    ]);
  };

  const rebaseDesktopLocalRepository = async () => {
    const repository = desktopRepository.value;
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      !desktopLocalRepositoryGitStatus.value?.clean ||
      !desktopLocalRepositoryGitStatus.value?.upstream ||
      desktopAction.value ||
      desktopRebaseLoading.value
    ) {
      return;
    }
    if (import.meta.client && !window.confirm(options.copy.value.confirmRebase)) return;

    desktopRebaseLoading.value = true;
    desktopAction.value = 'rebase';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await rebaseLocalRepositoryCommand(
        repository.cloneUrl
      );
      await refreshAfterRebase();
    } catch (error) {
      const message = getDesktopActionErrorMessage(error, 'Failed to rebase the local branch.');
      await showDesktopMessage(message, 'error');
      await refreshAfterRebase();
      desktopGitStatusError.value = message;
    } finally {
      desktopGitStatusLoading.value = false;
      desktopRebaseLoading.value = false;
      desktopAction.value = null;
    }
  };

  const abortDesktopLocalRepositoryRebase = async () => {
    const repository = desktopRepository.value;
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      desktopAction.value ||
      desktopAbortRebaseLoading.value
    ) {
      return;
    }
    if (import.meta.client && !window.confirm(options.copy.value.confirmAbortRebase)) return;

    desktopAbortRebaseLoading.value = true;
    desktopAction.value = 'abortRebase';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await abortLocalRepositoryRebaseCommand(
        repository.cloneUrl
      );
      await refreshAfterRebase();
    } catch (error) {
      const message = getDesktopActionErrorMessage(error, 'Failed to abort the local rebase.');
      await showDesktopMessage(message, 'error');
      await refreshAfterRebase();
      desktopGitStatusError.value = message;
    } finally {
      desktopGitStatusLoading.value = false;
      desktopAbortRebaseLoading.value = false;
      desktopAction.value = null;
    }
  };

  const commitDesktopLocalRepositoryChanges = async () => {
    const repository = desktopRepository.value;
    const commitMessage = desktopCommitMessage.value.trim();
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      !desktopCanCommitChanges.value ||
      !commitMessage
    ) {
      return;
    }
    if (import.meta.client && !window.confirm(options.copy.value.confirmCommit)) return;

    desktopAction.value = 'commit';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await commitLocalRepositoryChanges(
        repository.cloneUrl,
        commitMessage
      );
      void refreshAssociatedPullRequest();
      desktopCommitMessage.value = '';
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to commit local changes.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopAction.value = null;
    }
  };

  const amendDesktopLocalRepositoryCommit = async () => {
    const repository = desktopRepository.value;
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      !desktopCanAmendCommit.value
    ) {
      return;
    }
    if (import.meta.client && !window.confirm(options.copy.value.confirmAmend)) return;

    desktopAction.value = 'amend';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await amendLocalRepositoryCommit(
        repository.cloneUrl,
        desktopCommitMessage.value
      );
      void refreshAssociatedPullRequest();
      desktopCommitMessage.value = '';
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to amend the last commit.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopAction.value = null;
    }
  };

  const undoDesktopLocalRepositoryCommit = async () => {
    const repository = desktopRepository.value;
    if (!repository || !desktopLocalRepositoryStatus.value?.exists || !desktopCanUndoCommit.value) {
      return;
    }
    if (import.meta.client && !window.confirm(options.copy.value.confirmUndoCommit)) return;

    desktopAction.value = 'undoCommit';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await undoLocalRepositoryCommit(repository.cloneUrl);
      void refreshAssociatedPullRequest();
      desktopCommitMessage.value = '';
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to undo the last commit.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopAction.value = null;
    }
  };

  const stashDesktopLocalRepositoryChanges = async () => {
    const repository = desktopRepository.value;
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      !desktopCanStashChanges.value
    ) {
      return;
    }

    desktopAction.value = 'stash';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await stashLocalRepositoryChanges(
        repository.cloneUrl
      );
      void refreshAssociatedPullRequest();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryStashes();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to stash local changes.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopAction.value = null;
    }
  };

  const popDesktopLocalRepositoryStash = async (index: number) => {
    const repository = desktopRepository.value;
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      desktopStashPoppingIndex.value !== null
    ) {
      return;
    }

    desktopStashPoppingIndex.value = index;
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await popLocalRepositoryStash(
        repository.cloneUrl,
        index
      );
      void refreshAssociatedPullRequest();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryStashes();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to pop local stash.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
      await refreshDesktopLocalRepositoryGitStatus();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryStashes();
      await refreshDesktopLocalRepositoryCommitHistory();
    } finally {
      desktopGitStatusLoading.value = false;
      desktopStashPoppingIndex.value = null;
    }
  };

  const applyDesktopLocalRepositoryStash = async (index: number) => {
    const repository = desktopRepository.value;
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      desktopStashApplyingIndex.value !== null ||
      desktopStashPoppingIndex.value !== null ||
      desktopStashClearing.value
    ) {
      return;
    }

    desktopStashApplyingIndex.value = index;
    desktopStashActionError.value = '';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await applyLocalRepositoryStash(
        repository.cloneUrl,
        index
      );
      void refreshAssociatedPullRequest();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryStashes();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to apply local stash.'
      );
      desktopStashActionError.value = desktopGitStatusError.value;
      await showDesktopMessage(desktopGitStatusError.value, 'error');
      await refreshDesktopLocalRepositoryGitStatus();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryStashes();
      await refreshDesktopLocalRepositoryCommitHistory();
    } finally {
      desktopGitStatusLoading.value = false;
      desktopStashApplyingIndex.value = null;
    }
  };

  const clearDesktopLocalRepositoryStashes = async () => {
    const repository = desktopRepository.value;
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      desktopStashApplyingIndex.value !== null ||
      desktopStashPoppingIndex.value !== null ||
      desktopStashClearing.value
    ) {
      return;
    }
    if (import.meta.client && !window.confirm(options.copy.value.confirmClearStashes)) return;

    desktopStashClearing.value = true;
    desktopStashActionError.value = '';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await clearLocalRepositoryStashes(
        repository.cloneUrl
      );
      void refreshAssociatedPullRequest();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryStashes();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to clear local stashes.'
      );
      desktopStashActionError.value = desktopGitStatusError.value;
      await showDesktopMessage(desktopGitStatusError.value, 'error');
      await refreshDesktopLocalRepositoryGitStatus();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryStashes();
      await refreshDesktopLocalRepositoryCommitHistory();
    } finally {
      desktopGitStatusLoading.value = false;
      desktopStashClearing.value = false;
    }
  };

  const runDesktopChangedFileAction = async (
    action: 'stage' | 'unstage',
    file: DesktopLocalRepositoryChangedFile,
    command: (
      repositoryUrl: string,
      relativePath: string
    ) => Promise<DesktopLocalRepositoryGitStatus>
  ) => {
    const repository = desktopRepository.value;
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      file.conflicted ||
      desktopStagingChangedFilePaths.value[file.path] ||
      desktopUnstagingChangedFilePaths.value[file.path]
    ) {
      return;
    }

    const loadingPaths =
      action === 'stage' ? desktopStagingChangedFilePaths : desktopUnstagingChangedFilePaths;
    loadingPaths.value = { ...loadingPaths.value, [file.path]: true };
    desktopChangedFileActionError.value = '';
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await command(repository.cloneUrl, file.path);
      await refreshDesktopLocalRepositoryGitStatus();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
      await refreshAssociatedPullRequest();
    } catch (error) {
      desktopChangedFileActionError.value = getDesktopActionErrorMessage(
        error,
        action === 'stage' ? 'Failed to stage local file.' : 'Failed to unstage local file.'
      );
      await showDesktopMessage(desktopChangedFileActionError.value, 'error');
    } finally {
      const remainingPaths = { ...loadingPaths.value };
      delete remainingPaths[file.path];
      loadingPaths.value = remainingPaths;
    }
  };

  const stageDesktopChangedFile = async (file: DesktopLocalRepositoryChangedFile) => {
    await runDesktopChangedFileAction('stage', file, stageLocalRepositoryPath);
  };

  const unstageDesktopChangedFile = async (file: DesktopLocalRepositoryChangedFile) => {
    await runDesktopChangedFileAction('unstage', file, unstageLocalRepositoryPath);
  };

  const deleteDesktopLocalRepositoryBranch = async () => {
    const repository = desktopRepository.value;
    const branchName = desktopBranchToDelete.value;
    if (
      !repository ||
      !branchName ||
      branchName === desktopLocalRepositoryGitStatus.value?.branch ||
      !desktopLocalRepositoryStatus.value?.exists ||
      desktopBranchAction.value ||
      desktopDeleteBranchLoading.value
    ) {
      return;
    }
    if (
      import.meta.client &&
      !window.confirm(`${options.copy.value.confirmDeleteBranch} ${branchName}`)
    ) {
      return;
    }

    desktopDeleteBranchLoading.value = true;
    desktopBranchAction.value = true;
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await deleteLocalRepositoryBranch(
        repository.cloneUrl,
        branchName
      );
      void refreshAssociatedPullRequest();
      desktopBranchToDelete.value = '';
      await refreshDesktopLocalRepositoryBranches();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to delete local branch.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopBranchAction.value = false;
      desktopDeleteBranchLoading.value = false;
    }
  };

  const switchDesktopLocalRepositoryBranch = async (event: Event) => {
    const target = event.target;
    const branchName = target instanceof HTMLSelectElement ? target.value : '';
    const repository = desktopRepository.value;
    if (
      !repository ||
      !branchName ||
      branchName === desktopLocalRepositoryGitStatus.value?.branch ||
      !desktopLocalRepositoryStatus.value?.exists ||
      desktopBranchAction.value
    ) {
      return;
    }

    desktopBranchAction.value = true;
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await switchLocalRepositoryBranch(
        repository.cloneUrl,
        branchName
      );
      void refreshAssociatedPullRequest();
      await refreshDesktopLocalRepositoryBranches();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to switch local branch.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopBranchAction.value = false;
    }
  };

  const createDesktopLocalRepositoryBranch = async () => {
    const repository = desktopRepository.value;
    const branchName = desktopNewBranchName.value.trim();
    if (
      !repository ||
      !branchName ||
      !desktopLocalRepositoryStatus.value?.exists ||
      desktopBranchAction.value ||
      desktopCreateBranchLoading.value
    ) {
      return;
    }

    desktopCreateBranchLoading.value = true;
    desktopBranchAction.value = true;
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await createLocalRepositoryBranch(
        repository.cloneUrl,
        branchName
      );
      void refreshAssociatedPullRequest();
      desktopNewBranchName.value = '';
      await refreshDesktopLocalRepositoryBranches();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to create local branch.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopBranchAction.value = false;
      desktopCreateBranchLoading.value = false;
    }
  };

  const checkoutDesktopRemoteLocalRepositoryBranch = async () => {
    const repository = desktopRepository.value;
    const remoteBranchName = desktopRemoteBranchName.value;
    if (
      !repository ||
      !remoteBranchName ||
      !desktopLocalRepositoryStatus.value?.exists ||
      desktopBranchAction.value ||
      desktopCheckoutRemoteBranchLoading.value
    ) {
      return;
    }

    desktopCheckoutRemoteBranchLoading.value = true;
    desktopBranchAction.value = true;
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await checkoutRemoteLocalRepositoryBranch(
        repository.cloneUrl,
        remoteBranchName
      );
      void refreshAssociatedPullRequest();
      desktopRemoteBranchName.value = '';
      await refreshDesktopLocalRepositoryBranches();
      await refreshDesktopLocalRepositoryChangedFiles();
      await refreshDesktopLocalRepositoryCommitHistory();
    } catch (error) {
      desktopGitStatusError.value = getDesktopActionErrorMessage(
        error,
        'Failed to checkout remote branch.'
      );
      await showDesktopMessage(desktopGitStatusError.value, 'error');
    } finally {
      desktopGitStatusLoading.value = false;
      desktopBranchAction.value = false;
      desktopCheckoutRemoteBranchLoading.value = false;
    }
  };

  const openDesktopChangedFile = async (file: DesktopLocalRepositoryChangedFile) => {
    const repository = desktopRepository.value;
    if (!repository || !desktopLocalRepositoryStatus.value?.exists || !file.openable) return;

    try {
      await openLocalRepositoryPath(repository.cloneUrl, file.path);
    } catch (error) {
      const message = getDesktopActionErrorMessage(error, 'Failed to open local file.');
      await showDesktopMessage(message, 'error');
    }
  };

  const copyDesktopCloneUrl = async () => {
    const repository = desktopRepository.value;
    if (!repository || desktopAction.value) return;

    desktopAction.value = 'copy';
    try {
      const didCopy = await writeClipboardText(repository.cloneUrl, {
        label: `${repository.fullName} clone URL`,
      });
      if (!didCopy) {
        throw new Error('Failed to copy clone URL.');
      }

      desktopCloneCopied.value = true;
      if (desktopCloneCopiedTimer) {
        clearTimeout(desktopCloneCopiedTimer);
      }
      desktopCloneCopiedTimer = setTimeout(() => {
        desktopCloneCopied.value = false;
        desktopCloneCopiedTimer = undefined;
      }, 1500);
    } catch (error) {
      const message = getDesktopActionErrorMessage(error, 'Failed to copy clone URL.');
      await showDesktopMessage(message, 'error');
    } finally {
      desktopAction.value = null;
    }
  };

  const submitCreatePullRequest = async () => {
    const repository = desktopRepository.value;
    const branch = desktopLocalRepositoryGitStatus.value?.branch;
    const base = createPullRequestBaseBranch.value.trim();
    const title = createPullRequestTitle.value.trim();
    if (
      !repository ||
      !desktopLocalRepositoryStatus.value?.exists ||
      !branch ||
      !base ||
      !title ||
      desktopAction.value
    ) {
      return;
    }

    desktopAction.value = 'createPR';
    try {
      const apiFetch = useNekoGitApiFetch();
      const pull = await apiFetch(`/api/repos/${repository.owner}/${repository.repo}/pulls`, {
        method: 'POST',
        body: {
          head: branch,
          base,
          title,
          body: createPullRequestBody.value.trim() || undefined,
        },
      });
      createPullRequestTitle.value = '';
      createPullRequestBody.value = '';
      void refreshAssociatedPullRequest();
      return pull;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create pull request.';
      await showDesktopMessage(message, 'error');
      throw error;
    } finally {
      desktopAction.value = null;
    }
  };

  onMounted(() => {
    void loadRuntimeInfo();
  });

  watch(
    () => [desktopAvailable.value, desktopCloneUrl.value],
    () => {
      resetDesktopLocalRepositoryListLimits();
      if (!desktopAvailable.value || !desktopCloneUrl.value) {
        desktopLocalRepositoryStatus.value = null;
        desktopStatusError.value = '';
        refreshDesktopLocalRepositoryReadState();
        return;
      }

      void refreshDesktopLocalRepositoryStatus();
    }
  );

  onUnmounted(() => {
    if (desktopCloneCopiedTimer) {
      clearTimeout(desktopCloneCopiedTimer);
    }
  });

  return {
    changedFilesExpanded,
    commitHistoryExpanded,
    desktopAction,
    desktopAvailable,
    desktopBranchAction,
    desktopBranchToDelete,
    desktopBranchesError,
    desktopBranchesLoading,
    desktopCanAmendCommit,
    desktopCanCommitChanges,
    desktopCanStashChanges,
    desktopCanUndoCommit,
    desktopChangedFileActionError,
    desktopChangedFileStatusLabels,
    desktopChangedFiles,
    desktopChangedFilesError,
    desktopChangedFilesLoading,
    desktopCloneCopied,
    desktopCommitHistory,
    desktopCommitHistoryError,
    desktopCommitHistoryLoading,
    desktopCommitMessage,
    desktopCheckoutRemoteBranchLoading,
    desktopCreateBranchLoading,
    desktopDeleteBranchLoading,
    desktopFileDiffError,
    desktopFileDiffLoading,
    desktopFileDiffSections,
    desktopGitBranchLabel,
    desktopGitChangeItems,
    desktopGitLastCommit,
    desktopGitLastCommitTime,
    desktopGitPushLabel,
    desktopGitStatusError,
    desktopGitStatusLabel,
    desktopGitStatusLoading,
    desktopGitStatusTone,
    desktopGitStatusVisible,
    desktopGitSyncBadges,
    desktopLocalBranches,
    desktopRemoteBranches,
    desktopLocalRepositoryFileDiff,
    desktopLocalRepositoryGitStatus,
    desktopLocalRepositoryLocation,
    desktopLocalRepositoryStashes,
    desktopLocalRepositoryStatus,
    desktopLocalRepositoryStatusLabel,
    desktopLocalRepositoryStatusTone,
    desktopSelectedChangedFilePath,
    desktopNewBranchName,
    desktopRemoteBranchName,
    desktopStashActionError,
    desktopStashApplyingIndex,
    desktopStashClearing,
    desktopStashPoppingIndex,
    desktopStagingChangedFilePaths,
    desktopStashesError,
    desktopStashesLoading,
    desktopUnstagingChangedFilePaths,
    desktopRepository,
    associatedPullRequest,
    prLoading,
    createPullRequestTitle,
    createPullRequestBody,
    createPullRequestBaseBranch,
    refreshAssociatedPullRequest,
    submitCreatePullRequest,
    adoptDesktopLocalRepository,
    amendDesktopLocalRepositoryCommit,
    cancelDesktopLocalRepositoryOperation,
    checkoutDesktopRemoteLocalRepositoryBranch,
    cloneDesktopRepository,
    commitDesktopLocalRepositoryChanges,
    copyDesktopCloneUrl,
    createDesktopLocalRepositoryBranch,
    deleteDesktopLocalRepositoryBranch,
    fetchDesktopLocalRepository,
    openDesktopChangedFile,
    openDesktopLocalRepository,
    openDesktopLocalRepositoryTerminal,
    abortDesktopLocalRepositoryRebase,
    applyDesktopLocalRepositoryStash,
    clearDesktopLocalRepositoryStashes,
    popDesktopLocalRepositoryStash,
    previewDesktopChangedFileDiff,
    pullDesktopLocalRepository,
    pushDesktopLocalRepository,
    rebaseDesktopLocalRepository,
    showAllDesktopChangedFiles,
    showAllDesktopCommitHistory,
    stageDesktopChangedFile,
    stashDesktopLocalRepositoryChanges,
    switchDesktopLocalRepositoryBranch,
    undoDesktopLocalRepositoryCommit,
    unstageDesktopChangedFile,
  };
}

/** Full return type of the local repository panel composable. */
export type LocalRepositoryPanelState = ReturnType<typeof useLocalRepositoryPanel>;
