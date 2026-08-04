import { computed, onMounted, onUnmounted, watch } from 'vue';

import type {
  DesktopLocalRepositoryChangedFile,
  DesktopLocalRepositoryGitStatus,
} from '~/composables/useDesktopRuntime';
import { buildCurrentGitHubRepository } from '~/utils/current-github-url-utils';

import {
  chooseCloneDestinationDirectory,
  getDesktopActionErrorMessage,
  showDesktopMessage,
} from './local-repository-panel/desktopDialogs';
import { useLocalRepositoryPanelRefreshers } from './local-repository-panel/refreshers';
import { useLocalRepositoryPanelState } from './local-repository-panel/state';
import type {
  DesktopRepositoryGitAction,
  LocalRepositoryCopy,
  UseLocalRepositoryPanelOptions,
} from './local-repository-panel/types';
import { useLocalRepositoryPanelViewModel } from './local-repository-panel/viewModel';

export type { LocalRepositoryCopy } from './local-repository-panel/types';

/** Full-featured local repository panel: status, branches, commits, diff, clone, and git actions. */
export function useLocalRepositoryPanel(options: UseLocalRepositoryPanelOptions) {
  const {
    available: desktopAvailable,
    checkoutRemoteLocalRepositoryBranch,
    cloneRepository,
    commitLocalRepositoryChanges,
    createLocalRepositoryBranch,
    fetchLocalRepository,
    getLocalRepositoryBranches,
    getLocalRepositoryChangedFiles,
    getLocalRepositoryCommitHistory,
    getLocalRepositoryFileDiff,
    getLocalRepositoryGitStatus,
    getLocalRepositoryStatus,
    loadRuntimeInfo,
    openLocalRepository,
    openLocalRepositoryPath,
    openLocalRepositoryTerminal,
    pullLocalRepository,
    pushLocalRepository,
    stashLocalRepositoryChanges,
    switchLocalRepositoryBranch,
  } = useDesktopRuntime();
  const { writeClipboardText } = useClipboardWriter();

  const panelState = useLocalRepositoryPanelState();
  const {
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
    previewDesktopChangedFileDiff,
    refreshAssociatedPullRequest,
    refreshDesktopLocalRepositoryBranches,
    refreshDesktopLocalRepositoryChangedFiles,
    refreshDesktopLocalRepositoryCommitHistory,
    refreshDesktopLocalRepositoryGitStatus,
    refreshDesktopLocalRepositoryReadState,
    refreshDesktopLocalRepositoryStatus,
  } = useLocalRepositoryPanelRefreshers({
    commands: {
      getLocalRepositoryBranches,
      getLocalRepositoryChangedFiles,
      getLocalRepositoryCommitHistory,
      getLocalRepositoryFileDiff,
      getLocalRepositoryGitStatus,
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
    fallbackError: string
  ) => {
    const repository = desktopRepository.value;
    if (!repository || !desktopLocalRepositoryStatus.value?.exists || desktopAction.value) return;

    desktopAction.value = action;
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await command(repository.cloneUrl);
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
      'Failed to push local repository.'
    );
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

    desktopAction.value = 'commit';
    desktopGitStatusLoading.value = true;
    desktopGitStatusError.value = '';

    try {
      desktopLocalRepositoryGitStatus.value = await commitLocalRepositoryChanges(
        repository.cloneUrl,
        commitMessage
      );
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
      await refreshDesktopLocalRepositoryChangedFiles();
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
      const pull = await apiFetch(
        `/api/repos/${repository.owner}/${repository.repo}/pulls`,
        {
          method: 'POST',
          body: {
            head: branch,
            base,
            title,
            body: createPullRequestBody.value.trim() || undefined,
          },
        }
      );
      createPullRequestTitle.value = '';
      createPullRequestBody.value = '';
      void refreshAssociatedPullRequest();
      return pull;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create pull request.';
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
    desktopAction,
    desktopAvailable,
    desktopBranchAction,
    desktopBranchesError,
    desktopBranchesLoading,
    desktopCanCommitChanges,
    desktopCanStashChanges,
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
    desktopLocalRepositoryStatus,
    desktopLocalRepositoryStatusLabel,
    desktopLocalRepositoryStatusTone,
    desktopSelectedChangedFilePath,
    desktopNewBranchName,
    desktopRemoteBranchName,
    desktopRepository,
    associatedPullRequest,
    prLoading,
    createPullRequestTitle,
    createPullRequestBody,
    createPullRequestBaseBranch,
    refreshAssociatedPullRequest,
    submitCreatePullRequest,
    checkoutDesktopRemoteLocalRepositoryBranch,
    cloneDesktopRepository,
    commitDesktopLocalRepositoryChanges,
    copyDesktopCloneUrl,
    createDesktopLocalRepositoryBranch,
    fetchDesktopLocalRepository,
    openDesktopChangedFile,
    openDesktopLocalRepository,
    openDesktopLocalRepositoryTerminal,
    previewDesktopChangedFileDiff,
    pullDesktopLocalRepository,
    pushDesktopLocalRepository,
    stashDesktopLocalRepositoryChanges,
    switchDesktopLocalRepositoryBranch,
  };
}

/** Full return type of the local repository panel composable. */
export type LocalRepositoryPanelState = ReturnType<typeof useLocalRepositoryPanel>;
