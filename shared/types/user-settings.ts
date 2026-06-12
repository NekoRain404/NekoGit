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

/** User Settings. */
export interface UserSettings {
  version: 1;
  fonts: UserFontSettings;
  desktopNotifications: UserDesktopNotificationSettings;
  tabGroups: TabGroup[];
  customTabs: CustomTab[];
  updatedAt?: string;
}

/** User Settings Patch. */
export interface UserSettingsPatch {
  fonts?: Partial<UserFontSettings>;
  desktopNotifications?: Partial<UserDesktopNotificationSettings>;
  tabGroups?: TabGroup[];
  customTabs?: CustomTab[];
}
