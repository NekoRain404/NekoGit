/// Facade over the desktop runtime: runtime info, bundled server control, and local repository git commands.
import { computed, shallowRef } from 'vue';

import {
  createDiagnosticsReport,
  openAppData,
  openGithub,
  openGithubUrl,
  openServerLog,
  readGithubCliToken,
  restartBundledServer,
  setCurrentGitHubState,
  setNavigationState,
  setReviewState,
  setUnreadCount,
  setWindowTitle,
  showWindow,
} from './desktop-runtime/commands';
import { getCommandErrorMessage, invokeDesktopCommand } from './desktop-runtime/invoke';
import {
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
  openLocalRepository,
  openLocalRepositoryPath,
  openLocalRepositoryTerminal,
  popLocalRepositoryStash,
  pullLocalRepository,
  pushLocalRepository,
  rememberLocalRepository,
  stashLocalRepositoryChanges,
  switchLocalRepositoryBranch,
} from './desktop-runtime/localRepositoryCommands';
import type {
  DesktopAutostartStatus,
  DesktopRuntimeInfo,
  DesktopServerStatus,
} from './desktop-runtime/types';

export type {
  DesktopLocalRepositoryStash,
  DesktopLocalRepositoryStashes,
} from './desktop-runtime/localRepositoryCommands';

export type {
  DesktopAutostartStatus,
  DesktopCloneRepositoryResult,
  DesktopCurrentGitHubState,
  DesktopLocalRepositoryBranch,
  DesktopLocalRepositoryBranches,
  DesktopLocalRepositoryChangedFile,
  DesktopLocalRepositoryChangedFiles,
  DesktopLocalRepositoryCommitHistory,
  DesktopLocalRepositoryFileDiff,
  DesktopLocalRepositoryGitCommit,
  DesktopLocalRepositoryGitStatus,
  DesktopLocalRepositoryPathStatus,
  DesktopLocalRepositoryRemoteBranch,
  DesktopLocalRepositoryStatus,
  DesktopNavigationState,
  DesktopReviewState,
  DesktopRuntimeInfo,
  DesktopServerStatus,
} from './desktop-runtime/types';

const runtimeInfo = shallowRef<DesktopRuntimeInfo | null>(null);
const serverStatus = shallowRef<DesktopServerStatus | null>(null);
const autostartStatus = shallowRef<DesktopAutostartStatus | null>(null);
const loading = shallowRef(false);
const error = shallowRef('');

/** Access Tauri desktop runtime info, server status, and all local repository commands. */
export function useDesktopRuntime() {
  const available = computed(() => runtimeInfo.value !== null);

  const loadRuntimeInfo = async () => {
    if (loading.value) return runtimeInfo.value;

    loading.value = true;
    error.value = '';

    try {
      runtimeInfo.value = await invokeDesktopCommand<DesktopRuntimeInfo>('desktop_runtime_info');
      try {
        serverStatus.value =
          await invokeDesktopCommand<DesktopServerStatus>('desktop_server_status');
      } catch {
        serverStatus.value = null;
      }
      try {
        autostartStatus.value = await invokeDesktopCommand<DesktopAutostartStatus>(
          'desktop_autostart_status'
        );
      } catch {
        autostartStatus.value = null;
      }
    } catch (caughtError) {
      runtimeInfo.value = null;
      serverStatus.value = null;
      autostartStatus.value = null;
      error.value = getCommandErrorMessage(caughtError);
    } finally {
      loading.value = false;
    }

    return runtimeInfo.value;
  };

  const loadServerStatus = async () => {
    try {
      serverStatus.value = await invokeDesktopCommand<DesktopServerStatus>('desktop_server_status');
    } catch (caughtError) {
      serverStatus.value = null;
      throw caughtError;
    }

    return serverStatus.value;
  };

  const loadAutostartStatus = async () => {
    try {
      autostartStatus.value = await invokeDesktopCommand<DesktopAutostartStatus>(
        'desktop_autostart_status'
      );
    } catch (caughtError) {
      autostartStatus.value = null;
      throw caughtError;
    }

    return autostartStatus.value;
  };

  const setAutostartEnabled = async (enabled: boolean) => {
    autostartStatus.value = await invokeDesktopCommand<DesktopAutostartStatus>(
      'desktop_set_autostart_enabled',
      { enabled }
    );

    return autostartStatus.value;
  };

  return {
    runtimeInfo,
    serverStatus,
    autostartStatus,
    available,
    loading,
    error,
    loadRuntimeInfo,
    loadServerStatus,
    loadAutostartStatus,
    setAutostartEnabled,
    createDiagnosticsReport,
    openAppData,
    openServerLog,
    openGithub,
    openGithubUrl,
    cloneRepository,
    getLocalRepositoryStatus,
    getLocalRepositoryGitStatus,
    getLocalRepositoryBranches,
    getLocalRepositoryCommitHistory,
    getLocalRepositoryChangedFiles,
    getLocalRepositoryFileDiff,
    getLocalRepositoryStashes,
    fetchLocalRepository,
    pullLocalRepository,
    pushLocalRepository,
    rememberLocalRepository,
    switchLocalRepositoryBranch,
    createLocalRepositoryBranch,
    checkoutRemoteLocalRepositoryBranch,
    deleteLocalRepositoryBranch,
    commitLocalRepositoryChanges,
    stashLocalRepositoryChanges,
    popLocalRepositoryStash,
    openLocalRepository,
    openLocalRepositoryTerminal,
    openLocalRepositoryPath,
    readGithubCliToken,
    setUnreadCount,
    setWindowTitle,
    setNavigationState,
    setReviewState,
    setCurrentGitHubState,
    showWindow,
    restartBundledServer,
  };
}
