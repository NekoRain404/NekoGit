///  Utils / User Settings Utils - Read, save, and patch per-user settings through a storage adapter, keyed by the session login.
import type { H3Event } from 'h3';

import type { UserSettings } from '#shared/types/user-settings';
import {
  createDefaultUserSettings,
  mergeUserSettingsPatch,
  normalizeUserSettings,
} from '#shared/utils/user-settings';

import {
  getUserSettingsStorageAdapter,
  type UserSettingsStorageAdapter,
} from './user-settings-storage-utils';

type UserSettingsService = {
  read: (userLogin: string) => Promise<UserSettings>;
  save: (userLogin: string, settings: UserSettings) => Promise<UserSettings>;
  patch: (userLogin: string, patch: unknown) => Promise<UserSettings>;
};

/** Normalize stored settings, falling back to defaults when nothing is persisted yet. */
const normalizeStoredUserSettings = (storedSettings: UserSettings | null) => {
  return normalizeUserSettings(storedSettings, createDefaultUserSettings());
};

/** Normalize and stamp a settings object with the current `updatedAt` timestamp before persisting. */
const prepareUserSettingsForWrite = (settings: UserSettings): UserSettings => {
  return {
    ...normalizeUserSettings(settings),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Create a user settings service backed by the given storage adapter.
 * Provides read, save (full replace), and patch (merge) operations.
 */
export function createUserSettingsService(
  storage: UserSettingsStorageAdapter = getUserSettingsStorageAdapter()
): UserSettingsService {
  return {
    async read(userLogin) {
      return normalizeStoredUserSettings(await storage.read(userLogin));
    },
    async save(userLogin, settings) {
      const nextSettings = prepareUserSettingsForWrite(settings);

      await storage.write(userLogin, nextSettings);
      return nextSettings;
    },
    async patch(userLogin, patch) {
      return storage.update(userLogin, (storedSettings) => {
        const currentSettings = normalizeStoredUserSettings(storedSettings);
        const nextSettings = mergeUserSettingsPatch(currentSettings, patch);

        return prepareUserSettingsForWrite(nextSettings);
      });
    },
  };
}

/**
 * Extract the authenticated user's login from the current session.
 * Throws a 401 if the session has no user login.
 */
export async function getUserSettingsLogin(event: H3Event) {
  const session = await getUserSession(event);
  const userLogin = session.user?.login?.trim();

  if (!userLogin) {
    throw createError({
      statusCode: 401,
      statusMessage: 'User session not found',
    });
  }

  return userLogin;
}

/** Read normalized user settings for a given login. */
export async function readUserSettings(userLogin: string) {
  return createUserSettingsService().read(userLogin);
}

/** Full-replace user settings for a given login, stamping the current timestamp. */
export async function saveUserSettings(userLogin: string, settings: UserSettings) {
  return createUserSettingsService().save(userLogin, settings);
}

/** Merge a partial patch into the existing user settings for a given login. */
export async function patchUserSettings(userLogin: string, patch: unknown) {
  return createUserSettingsService().patch(userLogin, patch);
}
