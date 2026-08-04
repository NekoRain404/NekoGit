import type { CustomTab } from './custom-search';
import type { TabGroup } from './tab-groups';

/** App Font Id. */
export type AppFontId = 'harmonyos-sans' | 'misans-latin' | 'system';
/** Code Font Id. */
export type CodeFontId = 'maple-mono' | 'jetbrains-mono' | 'system';

/** User Font Settings. */
export interface UserFontSettings {
  appFont: AppFontId;
  codeFont: CodeFontId;
  appSystemFont?: string;
  codeSystemFont?: string;
}

/** User Desktop Notification Settings. */
export interface UserDesktopNotificationSettings {
  enabled: boolean;
  batchNewNotifications: boolean;
  quietWhenFocused: boolean;
}

/**
 * Outbound network settings for server-side GitHub API calls
 * (e.g. HTTP/HTTPS proxy when the host cannot reach api.github.com directly).
 */
export interface UserNetworkSettings {
  /** When true, use proxyUrl for Octokit/GitHub requests. */
  proxyEnabled: boolean;
  /**
   * Proxy URL for HTTP and HTTPS, e.g. `http://127.0.0.1:7890`.
   * Only `http:` and `https:` schemes are accepted.
   */
  proxyUrl: string;
}

/** User Settings. */
export interface UserSettings {
  version: 1;
  fonts: UserFontSettings;
  desktopNotifications: UserDesktopNotificationSettings;
  network: UserNetworkSettings;
  tabGroups: TabGroup[];
  customTabs: CustomTab[];
  updatedAt?: string;
}

/** User Settings Patch. */
export interface UserSettingsPatch {
  fonts?: Partial<UserFontSettings>;
  desktopNotifications?: Partial<UserDesktopNotificationSettings>;
  network?: Partial<UserNetworkSettings>;
  tabGroups?: TabGroup[];
  customTabs?: CustomTab[];
}
