/// Client plugin syncing current GitHub URL/repository state and handling desktop open/clone commands.
const desktopOpenCurrentGitHubEvent = 'nekogit:open-current-github';
const desktopOpenGitHubFromClipboardEvent = 'nekogit:open-github-from-clipboard';
const desktopCopyCurrentGitHubEvent = 'nekogit:copy-current-github';
const desktopCopyCurrentRepositoryCloneUrlEvent = 'nekogit:copy-current-repository-clone-url';
const desktopCloneCurrentRepositoryEvent = 'nekogit:clone-current-repository';
const desktopOpenLocalRepositoryEvent = 'nekogit:open-local-repository';

export default defineNuxtPlugin(async () => {
  const { isTauri } = await import('@tauri-apps/api/core');
  if (!isTauri()) return;

  const { listen } = await import('@tauri-apps/api/event');
  const { watch } = await import('vue');
  const { open, message } = await import('@tauri-apps/plugin-dialog');
  const { currentGitHubRepository, currentGitHubUrl } = useCurrentGitHubUrl();
  const { openClipboardGithubUrl } = useClipboardGithubNavigation();
  const { writeClipboardText } = useClipboardWriter();
  const {
    cloneRepository,
    getLocalRepositoryStatus,
    openGithub,
    openGithubUrl,
    openLocalRepository,
    setCurrentGitHubState,
  } = useDesktopRuntime();
  const currentGitHubStateUnavailable = shallowRef(false);
  const localRepositoryAvailable = shallowRef(false);
  let localRepositoryStatusRequestId = 0;

  const syncCurrentGitHubMenuState = () => {
    if (currentGitHubStateUnavailable.value) {
      return;
    }

    void setCurrentGitHubState({
      hasCurrentUrl: Boolean(currentGitHubUrl.value),
      hasCurrentRepository: Boolean(currentGitHubRepository.value),
      hasCurrentLocalRepository: localRepositoryAvailable.value,
    }).catch((error: unknown) => {
      currentGitHubStateUnavailable.value = true;
      console.warn('Failed to sync NekoGit current GitHub menu state.', error);
    });
  };

  const refreshLocalRepositoryStatus = async () => {
    const requestId = ++localRepositoryStatusRequestId;
    const repository = currentGitHubRepository.value;

    localRepositoryAvailable.value = false;
    syncCurrentGitHubMenuState();

    if (!repository) {
      return null;
    }

    try {
      const status = await getLocalRepositoryStatus(repository.cloneUrl);
      if (requestId !== localRepositoryStatusRequestId) {
        return status;
      }

      localRepositoryAvailable.value = status.exists;
      syncCurrentGitHubMenuState();
      return status;
    } catch (error) {
      if (requestId === localRepositoryStatusRequestId) {
        localRepositoryAvailable.value = false;
        syncCurrentGitHubMenuState();
      }
      console.warn('Failed to inspect current NekoGit local repository.', error);
      return null;
    }
  };

  const stopCurrentGitHubStateSync = watch(
    () => ({
      url: currentGitHubUrl.value,
      repository: currentGitHubRepository.value,
    }),
    () => {
      void refreshLocalRepositoryStatus();
    },
    { immediate: true }
  );

  const unlistenOpen = await listen(desktopOpenCurrentGitHubEvent, () => {
    const url = currentGitHubUrl.value;
    const action = url ? openGithubUrl(url) : openGithub();

    void action.catch((error: unknown) => {
      console.error('Failed to open current NekoGit page on GitHub.', error);
    });
  });

  const unlistenCopy = await listen(desktopCopyCurrentGitHubEvent, () => {
    const url = currentGitHubUrl.value;
    if (!url) {
      return;
    }

    void writeClipboardText(url, { label: 'NekoGit GitHub URL' }).then((didCopy) => {
      if (!didCopy) {
        console.error('Failed to copy current NekoGit GitHub URL.');
      }
    });
  });

  const unlistenCopyCloneUrl = await listen(desktopCopyCurrentRepositoryCloneUrlEvent, () => {
    const repository = currentGitHubRepository.value;
    if (!repository) {
      return;
    }

    void writeClipboardText(repository.cloneUrl, {
      label: `${repository.fullName} clone URL`,
    }).then((didCopy) => {
      if (!didCopy) {
        console.error('Failed to copy current NekoGit repository clone URL.');
      }
    });
  });

  const unlistenClone = await listen(desktopCloneCurrentRepositoryEvent, () => {
    const repository = currentGitHubRepository.value;
    if (!repository) {
      return;
    }

    void (async () => {
      const destinationDirectory = await open({
        title: `Clone ${repository.fullName}`,
        directory: true,
        multiple: false,
        canCreateDirectories: true,
      });

      if (typeof destinationDirectory !== 'string') {
        return;
      }

      const result = await cloneRepository(repository.cloneUrl, destinationDirectory);
      const openNote = result.openedDestination
        ? '\n\nOpened the cloned repository folder.'
        : result.openDestinationError
          ? `\n\nUnable to open the cloned folder: ${result.openDestinationError}`
          : '';

      await message(`Cloned ${repository.fullName} to:\n${result.destinationPath}${openNote}`, {
        title: 'NekoGit',
        kind: 'info',
      });
      await refreshLocalRepositoryStatus();
    })().catch((error: unknown) => {
      const messageText = error instanceof Error ? error.message : String(error);
      void message(messageText || 'Failed to clone repository.', {
        title: 'NekoGit',
        kind: 'error',
      });
      console.error('Failed to clone current NekoGit repository.', error);
    });
  });

  const unlistenOpenLocalRepository = await listen(desktopOpenLocalRepositoryEvent, () => {
    const repository = currentGitHubRepository.value;
    if (!repository) {
      return;
    }

    void openLocalRepository(repository.cloneUrl)
      .then((status) => {
        localRepositoryAvailable.value = status.exists;
        syncCurrentGitHubMenuState();
      })
      .catch((error: unknown) => {
        localRepositoryAvailable.value = false;
        syncCurrentGitHubMenuState();
        const messageText = error instanceof Error ? error.message : String(error);
        void message(messageText || 'Failed to open local repository.', {
          title: 'NekoGit',
          kind: 'error',
        });
        console.error('Failed to open current NekoGit local repository.', error);
      });
  });

  const unlistenClipboardOpen = await listen(desktopOpenGitHubFromClipboardEvent, () => {
    void openClipboardGithubUrl().catch((error: unknown) => {
      console.error('Failed to open clipboard GitHub URL in NekoGit.', error);
    });
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      void unlistenOpen();
      void unlistenClipboardOpen();
      void unlistenCopy();
      void unlistenCopyCloneUrl();
      void unlistenClone();
      void unlistenOpenLocalRepository();
      stopCurrentGitHubStateSync();
    });
  }
});
