import type { CustomTab } from './custom-search';
import type { TabGroup } from './tab-groups';

export type AppFontId = 'harmonyos-sans' | 'misans-latin' | 'system';
export type CodeFontId = 'maple-mono' | 'jetbrains-mono' | 'system';

export interface UserFontSettings {
  appFont: AppFontId;
  codeFont: CodeFontId;
  appSystemFont?: string;
  codeSystemFont?: string;
}

export interface UserDesktopNotificationSettings {
  enabled: boolean;
  batchNewNotifications: boolean;
  quietWhenFocused: boolean;
}

export interface UserSettings {
  version: 1;
  fonts: UserFontSettings;
  desktopNotifications: UserDesktopNotificationSettings;
  tabGroups: TabGroup[];
  customTabs: CustomTab[];
  updatedAt?: string;
}

export interface UserSettingsPatch {
  fonts?: Partial<UserFontSettings>;
  desktopNotifications?: Partial<UserDesktopNotificationSettings>;
  tabGroups?: TabGroup[];
  customTabs?: CustomTab[];
}
