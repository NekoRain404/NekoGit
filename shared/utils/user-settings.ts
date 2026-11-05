/// Defaults, validation, and normalization for user settings persistence.
/** Resolves user settings configuration from environment variables. */
import type {
  CustomTab,
  CustomTabArchived,
  CustomTabDraft,
  CustomTabOrder,
  CustomTabQuery,
  CustomTabReview,
  CustomTabSearchScope,
  CustomTabSearchType,
  CustomTabSort,
  CustomTabSource,
  CustomTabState,
  CustomTabVisibility,
} from '../types/custom-search';
import {
  BUILTIN_TAB_GROUP_ID,
  DEFAULT_CUSTOM_TAB_GROUP_ID,
  /** Tab Group. */
  type TabGroup,
} from '../types/tab-groups';
import type {
  AppFontId,
  CodeFontId,
  UserDesktopNotificationSettings,
  UserFontSettings,
  UserNetworkSettings,
  UserSettings,
} from '../types/user-settings';

/** APP FONTS. */
const APP_FONTS = new Set<AppFontId>(['harmonyos-sans', 'misans-latin', 'system']);
/** CODE FONTS. */
const CODE_FONTS = new Set<CodeFontId>(['maple-mono', 'jetbrains-mono', 'system']);

/** REQUIRED BUILTIN GROUP. */
const REQUIRED_BUILTIN_GROUP: TabGroup = {
  id: BUILTIN_TAB_GROUP_ID,
  name: 'Built-in Views',
  parentId: null,
  collapsed: false,
  source: 'system',
};

/** DEFAULT USER FONT SETTINGS. */
export const DEFAULT_USER_FONT_SETTINGS: UserFontSettings = {
  appFont: 'harmonyos-sans',
  codeFont: 'maple-mono',
};

/** DEFAULT DESKTOP NOTIFICATION SETTINGS. */
export const DEFAULT_DESKTOP_NOTIFICATION_SETTINGS: UserDesktopNotificationSettings = {
  enabled: true,
  batchNewNotifications: true,
  quietWhenFocused: true,
};

/** DEFAULT NETWORK / PROXY SETTINGS. */
export const DEFAULT_USER_NETWORK_SETTINGS: UserNetworkSettings = {
  proxyEnabled: false,
  proxyUrl: '',
};

/** has Own. */
const hasOwn = (value: object, key: string) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

/** normalize String. */
const normalizeString = (value: unknown, maxLength = 240) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  /** normalized. */
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
};

/** normalize String List. */
const normalizeStringList = (values: unknown) => {
  if (!Array.isArray(values)) {
    return undefined;
  }

  return values.flatMap((value) => {
    /** normalized. */
    const normalized = normalizeString(value);
    return normalized ? [normalized] : [];
  });
};

/** normalize System Font Family. */
export function normalizeSystemFontFamily(value: unknown) {
  /** normalized. */
  const normalized = normalizeString(value, 120);
  if (!normalized || /["\\;,{}()\r\n\f]/u.test(normalized)) {
    return undefined;
  }

  return normalized;
}

/** create Default Tab Groups. */
export function createDefaultTabGroups(): TabGroup[] {
  return [
    { ...REQUIRED_BUILTIN_GROUP },
    {
      id: DEFAULT_CUSTOM_TAB_GROUP_ID,
      name: 'General',
      parentId: null,
      collapsed: false,
      source: 'github-search',
    },
  ];
}

/** create Default User Settings. */
export function createDefaultUserSettings(): UserSettings {
  return {
    version: 1,
    fonts: { ...DEFAULT_USER_FONT_SETTINGS },
    desktopNotifications: { ...DEFAULT_DESKTOP_NOTIFICATION_SETTINGS },
    network: { ...DEFAULT_USER_NETWORK_SETTINGS },
    tabGroups: createDefaultTabGroups(),
    customTabs: [],
  };
}

/**
 * Normalize a proxy URL for outbound GitHub requests.
 * Accepts only http/https URLs; strips path/query/hash; allows optional userinfo.
 */
export function normalizeProxyUrl(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 512) {
    return '';
  }

  if ([...trimmed].some((ch) => ch.charCodeAt(0) < 32)) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    if (!url.hostname) {
      return '';
    }
    // Rebuild without path/query/hash.
    const port = url.port ? `:${url.port}` : '';
    const auth =
      url.username || url.password
        ? `${encodeURIComponent(decodeURIComponent(url.username))}${
            url.password ? `:${encodeURIComponent(decodeURIComponent(url.password))}` : ''
          }@`
        : '';
    return `${url.protocol}//${auth}${url.hostname}${port}`;
  } catch {
    return '';
  }
}

/** clone Tab Group. */
export function cloneTabGroup(group: TabGroup): TabGroup {
  return { ...group };
}

/** clone Tab Groups. */
export function cloneTabGroups(groups: TabGroup[]) {
  return groups.map((group) => cloneTabGroup(group));
}

/** clone Query. */
const cloneQuery = (query: CustomTabQuery = {}): CustomTabQuery => {
  return {
    ...query,
    labels: query.labels ? [...query.labels] : undefined,
    scopes: query.scopes ? [...query.scopes] : undefined,
  };
};

/** clone Custom Tab. */
export function cloneCustomTab(tab: CustomTab): CustomTab {
  return {
    ...tab,
    query: cloneQuery(tab.query),
  };
}

/** clone Custom Tabs. */
export function cloneCustomTabs(tabs: CustomTab[]) {
  return tabs.map((tab) => cloneCustomTab(tab));
}

/** normalize Tab Group. */
export function normalizeTabGroup(group: unknown): TabGroup | null {
  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    return null;
  }

  /** candidate. */
  const candidate = group as Partial<TabGroup>;
  /** id. */
  const id = normalizeString(candidate.id);
  /** name. */
  const name = normalizeString(candidate.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    parentId:
      typeof candidate.parentId === 'string' && candidate.parentId.trim().length > 0
        ? candidate.parentId.trim()
        : null,
    collapsed: typeof candidate.collapsed === 'boolean' ? candidate.collapsed : false,
    source:
      candidate.source === 'system' || candidate.source === 'github-search'
        ? candidate.source
        : 'github-search',
  };
}

/** ensure Required Tab Groups. */
export function ensureRequiredTabGroups(groups: TabGroup[]) {
  /** group Map. */
  const groupMap = new Map(groups.map((group) => [group.id, cloneTabGroup(group)]));
  /** builtin Group. */
  const builtinGroup = groupMap.get(BUILTIN_TAB_GROUP_ID);

  if (builtinGroup) {
    groupMap.delete(BUILTIN_TAB_GROUP_ID);
  }

  /** resolved Builtin. */
  const resolvedBuiltin: TabGroup = {
    ...(builtinGroup ?? REQUIRED_BUILTIN_GROUP),
    id: BUILTIN_TAB_GROUP_ID,
    name: REQUIRED_BUILTIN_GROUP.name,
    parentId: null,
    source: 'system',
  };

  return [resolvedBuiltin, ...groupMap.values()];
}

/** normalize Tab Groups. */
export function normalizeTabGroups(value: unknown, fallback = createDefaultTabGroups()) {
  if (!Array.isArray(value)) {
    return cloneTabGroups(fallback);
  }

  /** groups. */
  const groups = value
    .map((entry) => normalizeTabGroup(entry))
    .filter((entry): entry is TabGroup => entry !== null);

  return groups.length > 0 ? ensureRequiredTabGroups(groups) : cloneTabGroups(fallback);
}

/** normalize Query. */
const normalizeQuery = (query: unknown): CustomTabQuery => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {};
  }

  /** candidate. */
  const candidate = query as Partial<CustomTabQuery>;
  /** state. */
  const state = candidate.state;
  /** normalized State. */
  const normalizedState: CustomTabState | undefined =
    state === 'open' || state === 'closed' || state === 'all' ? state : undefined;
  /** type. */
  const type = candidate.type;
  /** normalized Type. */
  const normalizedType: CustomTabSearchType | undefined =
    type === 'issues' || type === 'pulls' || type === 'all' ? type : undefined;
  /** sort. */
  const sort = candidate.sort;
  /** normalized Sort. */
  const normalizedSort: CustomTabSort | undefined =
    sort === 'best-match' ||
    sort === 'comments' ||
    sort === 'reactions' ||
    sort === 'interactions' ||
    sort === 'created' ||
    sort === 'updated'
      ? sort
      : undefined;
  /** order. */
  const order = candidate.order;
  /** normalized Order. */
  const normalizedOrder: CustomTabOrder | undefined =
    order === 'asc' || order === 'desc' ? order : undefined;
  /** visibility. */
  const visibility = candidate.visibility;
  /** normalized Visibility. */
  const normalizedVisibility: CustomTabVisibility | undefined =
    visibility === 'any' || visibility === 'public' || visibility === 'private'
      ? visibility
      : undefined;
  /** archived. */
  const archived = candidate.archived;
  /** normalized Archived. */
  const normalizedArchived: CustomTabArchived | undefined =
    archived === 'exclude' || archived === 'include' || archived === 'only' ? archived : undefined;
  /** draft. */
  const draft = candidate.draft;
  /** normalized Draft. */
  const normalizedDraft: CustomTabDraft | undefined =
    draft === 'any' || draft === 'draft' || draft === 'ready' ? draft : undefined;
  /** review. */
  const review = candidate.review;
  /** normalized Review. */
  const normalizedReview: CustomTabReview | undefined =
    review === 'any' ||
    review === 'none' ||
    review === 'required' ||
    review === 'approved' ||
    review === 'changes_requested'
      ? review
      : undefined;
  /** source Scopes. */
  const sourceScopes = candidate.scopes;
  /** scopes. */
  const scopes = Array.isArray(sourceScopes)
    ? sourceScopes.filter(
        (scope): scope is CustomTabSearchScope =>
          scope === 'title' || scope === 'body' || scope === 'comments'
      )
    : undefined;
  /** per Page. */
  const perPage =
    typeof candidate.perPage === 'number' && Number.isFinite(candidate.perPage)
      ? Math.min(Math.max(Math.trunc(candidate.perPage), 1), 100)
      : undefined;

  return {
    text: normalizeString(candidate.text),
    type: normalizedType,
    repo: normalizeString(candidate.repo),
    org: normalizeString(candidate.org),
    user: normalizeString(candidate.user),
    labels: normalizeStringList(candidate.labels),
    author: normalizeString(candidate.author),
    assignee: normalizeString(candidate.assignee),
    mentions: normalizeString(candidate.mentions),
    commenter: normalizeString(candidate.commenter),
    involves: normalizeString(candidate.involves),
    milestone: normalizeString(candidate.milestone),
    state: normalizedState,
    scopes,
    visibility: normalizedVisibility,
    archived: normalizedArchived,
    draft: normalizedDraft,
    review: normalizedReview,
    base: normalizeString(candidate.base),
    head: normalizeString(candidate.head),
    sort: normalizedSort,
    order: normalizedOrder,
    perPage,
  };
};

/** normalize Custom Tab. */
export function normalizeCustomTab(tab: unknown): CustomTab | null {
  if (!tab || typeof tab !== 'object' || Array.isArray(tab)) {
    return null;
  }

  /** candidate. */
  const candidate = tab as Partial<CustomTab>;
  /** id. */
  const id = normalizeString(candidate.id);
  /** group Id. */
  const groupId = normalizeString(candidate.groupId);
  /** name. */
  const name = normalizeString(candidate.name);
  /** source. */
  const source: CustomTabSource =
    candidate.source === 'github-search' ? candidate.source : 'github-search';

  if (!id || !groupId || !name) {
    return null;
  }

  return {
    id,
    groupId,
    name,
    subtitle: normalizeString(candidate.subtitle),
    source,
    query: normalizeQuery(candidate.query),
  };
}

/** normalize Custom Tabs. */
export function normalizeCustomTabs(value: unknown, fallback: CustomTab[] = []) {
  if (!Array.isArray(value)) {
    return cloneCustomTabs(fallback);
  }

  return value
    .map((entry) => normalizeCustomTab(entry))
    .filter((entry): entry is CustomTab => entry !== null);
}

/** normalize User Font Settings. */
export function normalizeUserFontSettings(
  value: unknown,
  fallback: UserFontSettings = DEFAULT_USER_FONT_SETTINGS
): UserFontSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }

  /** candidate. */
  const candidate = value as Partial<UserFontSettings>;
  let appFont: AppFontId = APP_FONTS.has(candidate.appFont as AppFontId)
    ? (candidate.appFont as AppFontId)
    : fallback.appFont;
  let codeFont: CodeFontId = CODE_FONTS.has(candidate.codeFont as CodeFontId)
    ? (candidate.codeFont as CodeFontId)
    : fallback.codeFont;
  /** app System Font. */
  const appSystemFont = normalizeSystemFontFamily(
    candidate.appSystemFont ?? fallback.appSystemFont
  );
  /** code System Font. */
  const codeSystemFont = normalizeSystemFontFamily(
    candidate.codeSystemFont ?? fallback.codeSystemFont
  );

  if (appFont === 'system' && !appSystemFont) {
    appFont = fallback.appFont === 'system' ? DEFAULT_USER_FONT_SETTINGS.appFont : fallback.appFont;
  }

  if (codeFont === 'system' && !codeSystemFont) {
    codeFont =
      fallback.codeFont === 'system' ? DEFAULT_USER_FONT_SETTINGS.codeFont : fallback.codeFont;
  }

  return {
    appFont,
    codeFont,
    appSystemFont,
    codeSystemFont,
  };
}

/** normalize Desktop Notification Settings. */
export function normalizeDesktopNotificationSettings(
  value: unknown,
  fallback: UserDesktopNotificationSettings = DEFAULT_DESKTOP_NOTIFICATION_SETTINGS
): UserDesktopNotificationSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }

  /** candidate. */
  const candidate = value as Partial<UserDesktopNotificationSettings>;

  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : fallback.enabled,
    batchNewNotifications:
      typeof candidate.batchNewNotifications === 'boolean'
        ? candidate.batchNewNotifications
        : fallback.batchNewNotifications,
    quietWhenFocused:
      typeof candidate.quietWhenFocused === 'boolean'
        ? candidate.quietWhenFocused
        : fallback.quietWhenFocused,
  };
}

/** normalize Network / Proxy Settings. */
export function normalizeUserNetworkSettings(
  value: unknown,
  fallback: UserNetworkSettings = DEFAULT_USER_NETWORK_SETTINGS
): UserNetworkSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }

  const candidate = value as Partial<UserNetworkSettings>;
  const proxyUrl =
    candidate.proxyUrl !== undefined ? normalizeProxyUrl(candidate.proxyUrl) : fallback.proxyUrl;
  const proxyEnabled =
    typeof candidate.proxyEnabled === 'boolean' ? candidate.proxyEnabled : fallback.proxyEnabled;

  // Enabling without a valid URL is treated as disabled.
  return {
    proxyEnabled: proxyEnabled && Boolean(proxyUrl),
    proxyUrl,
  };
}

/** normalize User Settings. */
export function normalizeUserSettings(value: unknown, fallback = createDefaultUserSettings()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...fallback,
      fonts: { ...fallback.fonts },
      desktopNotifications: { ...fallback.desktopNotifications },
      network: { ...fallback.network },
      tabGroups: cloneTabGroups(fallback.tabGroups),
      customTabs: cloneCustomTabs(fallback.customTabs),
    };
  }

  /** candidate. */
  const candidate = value as Partial<UserSettings>;

  return {
    version: 1 as const,
    fonts: normalizeUserFontSettings(candidate.fonts, fallback.fonts),
    desktopNotifications: normalizeDesktopNotificationSettings(
      candidate.desktopNotifications,
      fallback.desktopNotifications
    ),
    network: normalizeUserNetworkSettings(candidate.network, fallback.network),
    tabGroups: normalizeTabGroups(candidate.tabGroups, fallback.tabGroups),
    customTabs: normalizeCustomTabs(candidate.customTabs, fallback.customTabs),
    updatedAt: normalizeString(candidate.updatedAt),
  };
}

/** merge User Settings Patch. */
export function mergeUserSettingsPatch(current: UserSettings, patch: unknown) {
  /** base. */
  const base = normalizeUserSettings(current);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return base;
  }

  /** candidate. */
  const candidate = patch as Partial<UserSettings>;

  return {
    version: 1 as const,
    fonts: hasOwn(candidate, 'fonts')
      ? normalizeUserFontSettings({ ...base.fonts, ...candidate.fonts }, base.fonts)
      : { ...base.fonts },
    desktopNotifications: hasOwn(candidate, 'desktopNotifications')
      ? normalizeDesktopNotificationSettings(
          { ...base.desktopNotifications, ...candidate.desktopNotifications },
          base.desktopNotifications
        )
      : { ...base.desktopNotifications },
    network: hasOwn(candidate, 'network')
      ? normalizeUserNetworkSettings({ ...base.network, ...candidate.network }, base.network)
      : { ...base.network },
    tabGroups: hasOwn(candidate, 'tabGroups')
      ? normalizeTabGroups(candidate.tabGroups, base.tabGroups)
      : cloneTabGroups(base.tabGroups),
    customTabs: hasOwn(candidate, 'customTabs')
      ? normalizeCustomTabs(candidate.customTabs, base.customTabs)
      : cloneCustomTabs(base.customTabs),
    updatedAt: base.updatedAt,
  };
}

/** is Default Tab Groups. */
export function isDefaultTabGroups(groups: TabGroup[]) {
  /** normalized. */
  const normalized = normalizeTabGroups(groups);
  return (
    normalized.length === 2 &&
    normalized[0]?.id === BUILTIN_TAB_GROUP_ID &&
    normalized[1]?.id === DEFAULT_CUSTOM_TAB_GROUP_ID &&
    normalized[1]?.name === 'General'
  );
}
