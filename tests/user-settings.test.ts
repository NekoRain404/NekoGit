import { describe, expect, test } from 'vitest';

import {
  createDefaultUserSettings,
  mergeUserSettingsPatch,
  normalizeProxyUrl,
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

  test('disables network proxy by default', () => {
    expect(createDefaultUserSettings().network).toEqual({
      proxyEnabled: false,
      proxyUrl: '',
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
    expect(normalizeUserSettings(storedSettings).network).toEqual({
      proxyEnabled: false,
      proxyUrl: '',
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

  test('normalizes proxy URLs and rejects unsupported schemes', () => {
    expect(normalizeProxyUrl('  http://127.0.0.1:7890/path?x=1  ')).toBe('http://127.0.0.1:7890');
    expect(normalizeProxyUrl('https://proxy.example:8443')).toBe('https://proxy.example:8443');
    expect(normalizeProxyUrl('socks5://127.0.0.1:1080')).toBe('');
    expect(normalizeProxyUrl('not-a-url')).toBe('');
  });

  test('merges network proxy patches and disables when URL is invalid', () => {
    const currentSettings = createDefaultUserSettings();
    const nextSettings = mergeUserSettingsPatch(currentSettings, {
      network: {
        proxyEnabled: true,
        proxyUrl: 'http://127.0.0.1:7890',
      },
    });

    expect(nextSettings.network).toEqual({
      proxyEnabled: true,
      proxyUrl: 'http://127.0.0.1:7890',
    });

    const invalid = mergeUserSettingsPatch(nextSettings, {
      network: {
        proxyEnabled: true,
        proxyUrl: 'ftp://bad',
      },
    });

    expect(invalid.network.proxyEnabled).toBe(false);
    expect(invalid.network.proxyUrl).toBe('');
  });
});

describe('resolveEnvProxyUrl helper surface', () => {
  test('normalizeProxyUrl accepts common local clash/v2ray style ports', () => {
    expect(normalizeProxyUrl('http://127.0.0.1:7890')).toBe('http://127.0.0.1:7890');
    expect(normalizeProxyUrl('http://localhost:10809')).toBe('http://localhost:10809');
  });
});
