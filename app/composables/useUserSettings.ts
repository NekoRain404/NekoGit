import type {
  UserDesktopNotificationSettings,
  UserFontSettings,
  UserSettings,
} from '#shared/types/user-settings';
import {
  createDefaultUserSettings,
  mergeUserSettingsPatch,
  normalizeSystemFontFamily,
  normalizeUserSettings,
} from '#shared/utils/user-settings';

/** A built-in font choice with its display label and CSS family name. */
export interface BuiltinFontOption<T extends string> {
  id: T;
  label: string;
  family: string;
}

/** Bundled application UI font options. */
export const builtinAppFontOptions: BuiltinFontOption<UserFontSettings['appFont']>[] = [
  {
    id: 'harmonyos-sans',
    label: 'HarmonyOS Sans',
    family: 'HarmonyOS Sans',
  },
  {
    id: 'misans-latin',
    label: 'MiSans Latin',
    family: 'MiSans Latin',
  },
];

/** Bundled monospace/code font options. */
export const builtinCodeFontOptions: BuiltinFontOption<UserFontSettings['codeFont']>[] = [
  {
    id: 'maple-mono',
    label: 'Maple Mono',
    family: 'Maple Mono',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    family: 'JetBrains Mono',
  },
];

const APP_FALLBACK =
  '"Mona Sans VF", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';
const CODE_FALLBACK =
  '"Maple Mono", ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace';

let clientLoadPromise: Promise<UserSettings | null> | null = null;
let clientLoadLogin: string | null = null;
let clientSaveQueue: Promise<unknown> = Promise.resolve();
let clientSaveRevision = 0;

/** Lowercase and trim a login string, or return null. */
const normalizeLogin = (login: unknown) => {
  return typeof login === 'string' && login.trim().length > 0 ? login.trim().toLowerCase() : null;
};

/** Serialise save requests so they do not race each other. */
const enqueueClientSettingsSave = <T>(task: () => Promise<T>) => {
  if (!import.meta.client) {
    return task();
  }

  const nextSave = clientSaveQueue.catch(() => undefined).then(task);
  clientSaveQueue = nextSave.catch(() => undefined);
  return nextSave;
};

/** Wrap a font family name in quotes with proper escaping for CSS. */
const quoteFontFamily = (family: string) => {
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};

/** Extract a message from an error or fall back to a default. */
const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback;
};

/** Build the CSS font-family stack for the application UI font. */
export function getAppFontStack(fonts: UserFontSettings) {
  if (fonts.appFont === 'system' && fonts.appSystemFont) {
    return `${quoteFontFamily(fonts.appSystemFont)}, ${APP_FALLBACK}`;
  }

  if (fonts.appFont === 'misans-latin') {
    return `${quoteFontFamily('MiSans Latin')}, ${APP_FALLBACK}`;
  }

  return `${quoteFontFamily('HarmonyOS Sans')}, ${APP_FALLBACK}`;
}

/** Build the CSS font-family stack for the monospace/code font. */
export function getCodeFontStack(fonts: UserFontSettings) {
  if (fonts.codeFont === 'system' && fonts.codeSystemFont) {
    return `${quoteFontFamily(fonts.codeSystemFont)}, ${CODE_FALLBACK}`;
  }

  if (fonts.codeFont === 'jetbrains-mono') {
    return `${quoteFontFamily('JetBrains Mono')}, ${CODE_FALLBACK}`;
  }

  return `${quoteFontFamily('Maple Mono')}, ${quoteFontFamily('Maple Mono NF CN')}, ${CODE_FALLBACK}`;
}

/** Load, persist, and optimistically update per-user settings with rollback support. */
export function useUserSettings() {
  const apiFetch = useNekoGitApiFetch();
  const { user } = useUserSession();
  const activeLogin = computed(() => normalizeLogin(user.value?.login));
  const settings = useState<UserSettings>('nekogit-user-settings', () =>
    createDefaultUserSettings()
  );
  const confirmedSettings = useState<UserSettings>('nekogit-user-settings-confirmed', () =>
    createDefaultUserSettings()
  );
  const confirmedLogin = useState<string | null>(
    'nekogit-user-settings-confirmed-login',
    () => null
  );
  const loadedLogin = useState<string | null>('nekogit-user-settings-loaded-login', () => null);
  const loading = useState('nekogit-user-settings-loading', () => false);
  const pendingSaves = useState('nekogit-user-settings-pending-saves', () => 0);
  const error = useState<string | null>('nekogit-user-settings-error', () => null);

  const loaded = computed(
    () => activeLogin.value !== null && loadedLogin.value === activeLogin.value
  );
  const saving = computed(() => pendingSaves.value > 0);
  const appFontFamily = computed(() => getAppFontStack(settings.value.fonts));
  const codeFontFamily = computed(() => getCodeFontStack(settings.value.fonts));

  const resetLocalSettings = () => {
    settings.value = createDefaultUserSettings();
    confirmedSettings.value = createDefaultUserSettings();
    confirmedLogin.value = null;
    loadedLogin.value = null;
    error.value = null;
  };

  const setConfirmedSettings = (login: string, nextSettings: UserSettings) => {
    confirmedSettings.value = normalizeUserSettings(nextSettings);
    confirmedLogin.value = login;
  };

  const getRollbackSettings = (login: string, fallback: UserSettings) => {
    return confirmedLogin.value === login ? confirmedSettings.value : fallback;
  };

  const loadSettings = async () => {
    const targetLogin = activeLogin.value;
    if (!targetLogin) {
      resetLocalSettings();
      return null;
    }

    if (loaded.value) {
      return settings.value;
    }

    if (import.meta.client && clientLoadPromise && clientLoadLogin === targetLogin) {
      return clientLoadPromise;
    }

    const loadPromise = Promise.resolve().then(async () => {
      loading.value = true;
      try {
        const response = await apiFetch<UserSettings>('/api/settings');
        if (activeLogin.value !== targetLogin) {
          return null;
        }

        const nextSettings = normalizeUserSettings(response);
        settings.value = nextSettings;
        setConfirmedSettings(targetLogin, nextSettings);
        loadedLogin.value = targetLogin;
        error.value = null;
        return settings.value;
      } catch (loadError) {
        if (activeLogin.value === targetLogin) {
          error.value = getErrorMessage(loadError, 'Unable to load settings.');
        }
        return null;
      } finally {
        loading.value = false;
        if (
          import.meta.client &&
          clientLoadPromise === loadPromise &&
          clientLoadLogin === targetLogin
        ) {
          clientLoadPromise = null;
          clientLoadLogin = null;
        }
      }
    });

    if (import.meta.client) {
      clientLoadPromise = loadPromise;
      clientLoadLogin = targetLogin;
    }

    return loadPromise;
  };

  const updateSettings = async (patch: unknown) => {
    const targetLogin = activeLogin.value;
    if (!targetLogin) {
      resetLocalSettings();
      error.value = 'Unable to save settings without a user session.';
      return null;
    }

    if (!loaded.value) {
      const loadedSettings = await loadSettings();
      if (!loadedSettings || activeLogin.value !== targetLogin) {
        return null;
      }
    }

    const requestBody =
      patch && typeof patch === 'object' && !Array.isArray(patch)
        ? (patch as Record<string, unknown>)
        : {};
    const previousSettings = settings.value;
    const optimisticSettings = mergeUserSettingsPatch(previousSettings, requestBody);
    const requestRevision = ++clientSaveRevision;

    settings.value = optimisticSettings;
    pendingSaves.value += 1;

    return enqueueClientSettingsSave(async () => {
      try {
        const response = await apiFetch<UserSettings>('/api/settings', {
          method: 'PUT',
          body: requestBody,
        });
        const nextSettings = normalizeUserSettings(response, optimisticSettings);

        if (activeLogin.value === targetLogin) {
          setConfirmedSettings(targetLogin, nextSettings);
        }

        if (activeLogin.value === targetLogin && requestRevision === clientSaveRevision) {
          settings.value = nextSettings;
          loadedLogin.value = targetLogin;
          error.value = null;
        }

        return nextSettings;
      } catch (saveError) {
        if (activeLogin.value === targetLogin && requestRevision === clientSaveRevision) {
          settings.value = normalizeUserSettings(
            getRollbackSettings(targetLogin, previousSettings)
          );
          error.value = getErrorMessage(saveError, 'Unable to save settings.');
        }

        return null;
      } finally {
        pendingSaves.value = Math.max(0, pendingSaves.value - 1);
      }
    });
  };

  const updateFonts = (fonts: Partial<UserFontSettings>) => {
    const nextFonts = {
      ...fonts,
      appSystemFont: normalizeSystemFontFamily(fonts.appSystemFont),
      codeSystemFont: normalizeSystemFontFamily(fonts.codeSystemFont),
    };

    return updateSettings({ fonts: nextFonts });
  };

  const updateDesktopNotifications = (
    desktopNotifications: Partial<UserDesktopNotificationSettings>
  ) => {
    return updateSettings({ desktopNotifications });
  };

  if (import.meta.client) {
    watch(activeLogin, (nextLogin, previousLogin) => {
      if (nextLogin === previousLogin) {
        return;
      }

      clientLoadPromise = null;
      clientLoadLogin = null;
      clientSaveRevision += 1;
      resetLocalSettings();

      if (nextLogin) {
        void loadSettings();
      }
    });
  }

  return {
    settings,
    loaded: readonly(loaded),
    loading: readonly(loading),
    saving: readonly(saving),
    error: readonly(error),
    appFontFamily,
    codeFontFamily,
    loadSettings,
    updateSettings,
    updateFonts,
    updateDesktopNotifications,
  };
}
