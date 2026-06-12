import { describe, expect, test } from 'vitest';

import {
  createDefaultUserSettings,
  mergeUserSettingsPatch,
  normalizeUserSettings,
} from '../shared/utils/user-settings';

describe('user settings helpers', () => {
  test('enables desktop notifications by default', () => {
    expect(createDefaultUserSettings().desktopNotifications).toEqual({
      enabled: true,
      batchNewNotifications: true,
      quietWhenFocused: true,
    });
  });

  test('fills desktop notification settings for stored settings created before the field existed', () => {
    const storedSettings = {
      version: 1,
      fonts: {
        appFont: 'harmonyos-sans',
        codeFont: 'maple-mono',
      },
      tabGroups: [],
      customTabs: [],
    };

    expect(normalizeUserSettings(storedSettings).desktopNotifications).toEqual({
      enabled: true,
      batchNewNotifications: true,
      quietWhenFocused: true,
    });
  });

  test('merges desktop notification patches without losing existing settings', () => {
    const currentSettings = createDefaultUserSettings();
    const nextSettings = mergeUserSettingsPatch(currentSettings, {
      desktopNotifications: {
        enabled: false,
        quietWhenFocused: false,
      },
    });

    expect(nextSettings.desktopNotifications).toEqual({
      enabled: false,
      batchNewNotifications: true,
      quietWhenFocused: false,
    });
    expect(nextSettings.fonts).toEqual(currentSettings.fonts);
  });

  test('ignores invalid desktop notification patch values', () => {
    const currentSettings = createDefaultUserSettings();
    const nextSettings = mergeUserSettingsPatch(currentSettings, {
      desktopNotifications: {
        enabled: 'no',
      },
    });

    expect(nextSettings.desktopNotifications).toEqual({
      enabled: true,
      batchNewNotifications: true,
      quietWhenFocused: true,
    });
  });
});
