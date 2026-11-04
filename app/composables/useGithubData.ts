/// Central data fetching, pagination, and state for dashboard notifications, issues, pulls, and repositories.
import { ref } from 'vue';

import type {
  DashboardIssueSearchItem,
  DashboardRepositoryListItem,
} from '#shared/types/dashboard';
import type {
  DashboardNotification,
  NotificationSubjectStateResult,
  NotificationSubjectStateTarget,
} from '#shared/types/notifications';
import {
  buildDashboardListFilterKey,
  buildDashboardListRequestPath,
  type DashboardListFilterInput,
} from '#shared/utils/dashboard-list-filter';
import {
  normalizeNotificationThreadId,
  normalizeNotificationThreadIds,
} from '#shared/utils/github-notification-threads';
import { appendCustomTabQueryParams } from '#shared/utils/github-search-query';
import type { CustomTabQuery, CustomTabSource } from '~/composables/useCustomTabs';
import type { DashboardTab } from '~/composables/useDashboardTabs';
import parseGitHubNotificationSubjectTarget, {
  toNotificationSubjectStateTarget,
} from '~/utils/parseGitHubNotificationSubjectTarget';

/** Pagination metadata returned alongside paginated list responses. */
export interface DashboardPaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

interface PaginatedDashboardResponse<T> {
  items: T[];
  total_count?: number;
  pagination: DashboardPaginationMeta;
}

/** Options that control silent or forced re-fetches. */
export interface DashboardFetchOptions {
  force?: boolean;
  silent?: boolean;
}

interface DashboardPageCache {
  notifications: Record<number, PaginatedDashboardResponse<DashboardNotification>>;
  issues: Record<string, Record<number, PaginatedDashboardResponse<DashboardIssueSearchItem>>>;
  pulls: Record<string, Record<number, PaginatedDashboardResponse<DashboardIssueSearchItem>>>;
  repos: Record<number, PaginatedDashboardResponse<DashboardRepositoryListItem>>;
  customTabs: Record<string, Record<number, PaginatedDashboardResponse<DashboardIssueSearchItem>>>;
}

interface MarkNotificationThreadsReadResponse {
  items: string[];
  failures: {
    threadId: string;
    message: string;
  }[];
}

const defaultPerPage = 20;
const maxCachedPagesPerCollection = 5;
const maxCachedCustomTabQueries = 25;
const maxCachedListFilterVariants = 10;

const createDefaultPaginationMeta = (): DashboardPaginationMeta => ({
  page: 1,
  perPage: defaultPerPage,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: 1,
});

const createPaginationState = (): Record<DashboardTab, DashboardPaginationMeta> => ({
  notifications: createDefaultPaginationMeta(),
  issues: createDefaultPaginationMeta(),
  pulls: createDefaultPaginationMeta(),
  repos: createDefaultPaginationMeta(),
});

const createPageCache = (): DashboardPageCache => ({
  notifications: {},
  issues: {},
  pulls: {},
  repos: {},
  customTabs: {},
});

const buildPaginationUrl = (path: string, page: number, perPage = defaultPerPage) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  return `${path}?${searchParams.toString()}`;
};

const parseNotificationSubjectStateTarget = (
  notification: DashboardNotification
): NotificationSubjectStateTarget | null => {
  const target = parseGitHubNotificationSubjectTarget(notification.subject);
  return target ? toNotificationSubjectStateTarget(target) : null;
};

const withPendingNotificationSubjectStates = (items: DashboardNotification[]) => {
  return items.map((item) => {
    const target = parseGitHubNotificationSubjectTarget(item.subject);
    if (!target) {
      return {
        ...item,
        subject: item.subject
          ? {
              ...item.subject,
              stateStatus: 'unavailable' as const,
            }
          : item.subject,
      };
    }

    return {
      ...item,
      subject: {
        ...item.subject,
        number: target.number,
        state: undefined,
        stateStatus: toNotificationSubjectStateTarget(target)
          ? ('pending' as const)
          : ('unavailable' as const),
      },
    };
  });
};

const collectUniqueNotificationSubjectTargets = (items: DashboardNotification[]) => {
  const targetsByKey = new Map<string, NotificationSubjectStateTarget>();

  for (const item of items) {
    const target = parseNotificationSubjectStateTarget(item);
    if (target) {
      targetsByKey.set(target.key, target);
    }
  }

  return Array.from(targetsByKey.values());
};

const shouldEnrichNotificationSubjectStates = (items: DashboardNotification[]) => {
  return items.some((item) => {
    const target = parseNotificationSubjectStateTarget(item);
    if (!target) return false;

    return item.subject?.stateStatus !== 'loaded';
  });
};

const applyNotificationSubjectStates = (
  items: DashboardNotification[],
  states: NotificationSubjectStateResult[]
) => {
  const statesByKey = new Map(states.map((item) => [item.key, item.state]));

  return items.map((item) => {
    const target = parseNotificationSubjectStateTarget(item);
    if (!target) return item;

    const state = statesByKey.get(target.key);
    return {
      ...item,
      subject: {
        ...item.subject,
        state,
        stateStatus: state ? ('loaded' as const) : ('error' as const),
      },
    };
  });
};

const markNotificationSubjectStateErrors = (items: DashboardNotification[]) => {
  return items.map((item) => {
    const target = parseNotificationSubjectStateTarget(item);
    if (!target) return item;

    return {
      ...item,
      subject: {
        ...item.subject,
        stateStatus: 'error' as const,
      },
    };
  });
};

const buildCustomTabQueryKey = (
  query: CustomTabQuery = {},
  source: CustomTabSource = 'github-search'
) => {
  const searchParams = new URLSearchParams({ source });
  appendCustomTabQueryParams(searchParams, query);
  if (query.perPage) {
    searchParams.set('per_page', String(query.perPage));
  }

  return searchParams.toString();
};

const buildCustomTabUrl = (
  path: string,
  page: number,
  query: CustomTabQuery,
  perPage = defaultPerPage
) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(query.perPage ?? perPage),
  });
  appendCustomTabQueryParams(searchParams, query);

  return `${path}?${searchParams.toString()}`;
};

/** Central data layer for dashboard notifications, issues, PRs, repos, and custom tab searches. */
export function useGithubData() {
  const apiFetch = useNekoGitApiFetch();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeRequestId = ref(0);
  const activeNotificationRequestId = ref(0);
  const activeNotificationStateRequestId = ref(0);
  const pageCache = ref(createPageCache());
  const pageCacheOrder = {
    notifications: [] as number[],
    issues: [] as string[],
    pulls: [] as string[],
    repos: [] as number[],
    customTabs: [] as string[],
    customTabPages: {} as Record<string, number[]>,
    issuePages: {} as Record<string, number[]>,
    pullPages: {} as Record<string, number[]>,
  };
  const notifications = ref<DashboardNotification[]>([]);
  const unreadNotificationCount = ref<number | null>(null);
  const issues = ref<DashboardIssueSearchItem[]>([]);
  const pulls = ref<DashboardIssueSearchItem[]>([]);
  const repos = ref<DashboardRepositoryListItem[]>([]);
  const pagination = ref(createPaginationState());
  const stats = ref({
    issues: 0,
    prs: 0,
    repos: 0,
  });

  const touchCachedPage = <T>(cache: Record<number, T>, order: number[], page: number) => {
    const existingIndex = order.indexOf(page);
    if (existingIndex >= 0) {
      order.splice(existingIndex, 1);
    }

    order.push(page);

    while (order.length > maxCachedPagesPerCollection) {
      const expiredPage = order.shift();
      if (expiredPage !== undefined) {
        delete cache[expiredPage];
      }
    }
  };

  const touchCustomTabCache = (queryKey: string, page: number) => {
    const existingQueryIndex = pageCacheOrder.customTabs.indexOf(queryKey);
    if (existingQueryIndex >= 0) {
      pageCacheOrder.customTabs.splice(existingQueryIndex, 1);
    }

    pageCacheOrder.customTabs.push(queryKey);

    const queryCache = pageCache.value.customTabs[queryKey];
    if (queryCache) {
      const queryPageOrder = pageCacheOrder.customTabPages[queryKey] ?? [];
      pageCacheOrder.customTabPages[queryKey] = queryPageOrder;
      touchCachedPage(queryCache, queryPageOrder, page);
    }

    while (pageCacheOrder.customTabs.length > maxCachedCustomTabQueries) {
      const expiredQueryKey = pageCacheOrder.customTabs.shift();
      if (expiredQueryKey) {
        delete pageCache.value.customTabs[expiredQueryKey];
        delete pageCacheOrder.customTabPages[expiredQueryKey];
      }
    }
  };

  const touchFilteredPageCache = (
    cache: Record<string, Record<number, PaginatedDashboardResponse<DashboardIssueSearchItem>>>,
    filterOrder: string[],
    pageOrder: Record<string, number[]>,
    filterKey: string,
    page: number
  ) => {
    const existingFilterIndex = filterOrder.indexOf(filterKey);
    if (existingFilterIndex >= 0) {
      filterOrder.splice(existingFilterIndex, 1);
    }

    filterOrder.push(filterKey);

    const filterCache = cache[filterKey];
    if (filterCache) {
      const filterPageOrder = pageOrder[filterKey] ?? [];
      pageOrder[filterKey] = filterPageOrder;
      touchCachedPage(filterCache, filterPageOrder, page);
    }

    while (filterOrder.length > maxCachedListFilterVariants) {
      const expiredFilterKey = filterOrder.shift();
      if (expiredFilterKey) {
        delete cache[expiredFilterKey];
        delete pageOrder[expiredFilterKey];
      }
    }
  };

  const applyNotificationsData = (data: PaginatedDashboardResponse<DashboardNotification>) => {
    notifications.value = data.items;
    pagination.value.notifications = data.pagination;
  };

  const withReadNotification = (items: DashboardNotification[], threadId: string) => {
    let updated = false;
    const nextItems = items.map((item) => {
      if (normalizeNotificationThreadId(item.id) !== threadId || item.unread === false) {
        return item;
      }

      updated = true;
      return {
        ...item,
        unread: false,
      };
    });

    return updated ? nextItems : items;
  };

  const withReadNotifications = (items: DashboardNotification[]) => {
    let updated = false;
    const nextItems = items.map((item) => {
      if (item.unread === false) {
        return item;
      }

      updated = true;
      return {
        ...item,
        unread: false,
      };
    });

    return updated ? nextItems : items;
  };

  const withReadNotificationSet = (items: DashboardNotification[], threadIds: Set<string>) => {
    let updated = false;
    const nextItems = items.map((item) => {
      const threadId = normalizeNotificationThreadId(item.id);
      if (!threadId || !threadIds.has(threadId) || item.unread === false) {
        return item;
      }

      updated = true;
      return {
        ...item,
        unread: false,
      };
    });

    return updated ? nextItems : items;
  };

  const withUnsubscribedNotification = (items: DashboardNotification[], threadId: string) => {
    let updated = false;
    const nextItems = items.map((item) => {
      if (normalizeNotificationThreadId(item.id) !== threadId) {
        return item;
      }

      const subscription = item.subscription;
      const hasSubscriptionObject = Boolean(subscription) && typeof subscription === 'object';
      const subscriptionState = hasSubscriptionObject
        ? (subscription as { subscribed?: unknown }).subscribed
        : undefined;

      if (item.subscribed === false && (!hasSubscriptionObject || subscriptionState === false)) {
        return item;
      }

      updated = true;
      return {
        ...item,
        subscribed: false,
        ...(hasSubscriptionObject
          ? {
              subscription: {
                ...(subscription as Record<string, unknown>),
                subscribed: false,
              },
            }
          : {}),
      };
    });

    return updated ? nextItems : items;
  };

  const applyReadNotification = (threadId: string) => {
    const activePage = pagination.value.notifications.page;

    notifications.value = withReadNotification(notifications.value, threadId);

    for (const [page, cachedData] of Object.entries(pageCache.value.notifications)) {
      const pageNumber = Number(page);
      const nextItems = withReadNotification(cachedData.items, threadId);
      if (nextItems === cachedData.items) {
        continue;
      }

      const nextData = {
        ...cachedData,
        items: nextItems,
      };
      pageCache.value.notifications[pageNumber] = nextData;

      if (pageNumber === activePage) {
        applyNotificationsData(nextData);
      }
    }
  };

  const applyUnsubscribedNotification = (threadId: string) => {
    const activePage = pagination.value.notifications.page;

    notifications.value = withUnsubscribedNotification(notifications.value, threadId);

    for (const [page, cachedData] of Object.entries(pageCache.value.notifications)) {
      const pageNumber = Number(page);
      const nextItems = withUnsubscribedNotification(cachedData.items, threadId);
      if (nextItems === cachedData.items) {
        continue;
      }

      const nextData = {
        ...cachedData,
        items: nextItems,
      };
      pageCache.value.notifications[pageNumber] = nextData;

      if (pageNumber === activePage) {
        applyNotificationsData(nextData);
      }
    }
  };

  const applyReadNotifications = () => {
    const activePage = pagination.value.notifications.page;

    notifications.value = withReadNotifications(notifications.value);

    for (const [page, cachedData] of Object.entries(pageCache.value.notifications)) {
      const pageNumber = Number(page);
      const nextItems = withReadNotifications(cachedData.items);
      if (nextItems === cachedData.items) {
        continue;
      }

      const nextData = {
        ...cachedData,
        items: nextItems,
      };
      pageCache.value.notifications[pageNumber] = nextData;

      if (pageNumber === activePage) {
        applyNotificationsData(nextData);
      }
    }
  };

  const applyReadNotificationSet = (threadIds: string[]) => {
    if (threadIds.length === 0) {
      return;
    }

    const activePage = pagination.value.notifications.page;
    const threadIdSet = new Set(threadIds);

    notifications.value = withReadNotificationSet(notifications.value, threadIdSet);

    for (const [page, cachedData] of Object.entries(pageCache.value.notifications)) {
      const pageNumber = Number(page);
      const nextItems = withReadNotificationSet(cachedData.items, threadIdSet);
      if (nextItems === cachedData.items) {
        continue;
      }

      const nextData = {
        ...cachedData,
        items: nextItems,
      };
      pageCache.value.notifications[pageNumber] = nextData;

      if (pageNumber === activePage) {
        applyNotificationsData(nextData);
      }
    }
  };

  const enrichNotificationSubjectStates = async (
    page: number,
    items: DashboardNotification[],
    notificationRequestId: number,
    applyToActiveList = true
  ) => {
    const targets = collectUniqueNotificationSubjectTargets(items);
    if (targets.length === 0) return;

    const stateRequestId = activeNotificationStateRequestId.value + 1;
    activeNotificationStateRequestId.value = stateRequestId;

    try {
      const data = await apiFetch<{ items: NotificationSubjectStateResult[] }>(
        '/api/notifications/subject-states',
        {
          method: 'POST',
          body: { targets },
        }
      );

      if (
        notificationRequestId !== activeNotificationRequestId.value ||
        stateRequestId !== activeNotificationStateRequestId.value
      ) {
        return;
      }

      const cachedData = pageCache.value.notifications[page];
      if (!cachedData) return;

      const enrichedItems = applyNotificationSubjectStates(cachedData.items, data.items);
      const enrichedData = {
        ...cachedData,
        items: enrichedItems,
      };

      pageCache.value.notifications[page] = enrichedData;
      if (applyToActiveList) {
        applyNotificationsData(enrichedData);
      }
    } catch (err) {
      if (
        notificationRequestId !== activeNotificationRequestId.value ||
        stateRequestId !== activeNotificationStateRequestId.value
      ) {
        return;
      }

      const cachedData = pageCache.value.notifications[page];
      if (!cachedData) return;

      const erroredData = {
        ...cachedData,
        items: markNotificationSubjectStateErrors(cachedData.items),
      };

      pageCache.value.notifications[page] = erroredData;
      if (applyToActiveList) {
        applyNotificationsData(erroredData);
      }
      console.error('Error enriching notification subject states:', err);
    }
  };

  const applyIssuesData = (data: PaginatedDashboardResponse<DashboardIssueSearchItem>) => {
    issues.value = data.items || [];
    stats.value.issues = data.total_count || 0;
    pagination.value.issues = data.pagination;
  };

  const applyPullsData = (data: PaginatedDashboardResponse<DashboardIssueSearchItem>) => {
    pulls.value = data.items || [];
    stats.value.prs = data.total_count || 0;
    pagination.value.pulls = data.pagination;
  };

  const applyReposData = (data: PaginatedDashboardResponse<DashboardRepositoryListItem>) => {
    repos.value = data.items;
    stats.value.repos = data.pagination.totalCount ?? data.items.length;
    pagination.value.repos = data.pagination;
  };

  /** Refresh the exact unread count; falls back to the current page count when unavailable. */
  const refreshUnreadNotificationCount = async () => {
    try {
      const data = await apiFetch<{ count?: unknown }>('/api/notifications/unread-count');
      unreadNotificationCount.value =
        typeof data?.count === 'number' && Number.isFinite(data.count)
          ? Math.max(0, Math.trunc(data.count))
          : null;
    } catch (error) {
      console.warn('Failed to refresh unread notification count:', error);
    }
  };

  const fetchNotifications = async (page = 1, options: DashboardFetchOptions = {}) => {
    const cachedData = pageCache.value.notifications[page];
    const shouldApplyNotificationsData = (resolvedPage: number) => {
      return !options.silent || pagination.value.notifications.page === resolvedPage;
    };

    if (cachedData && !options.force) {
      touchCachedPage(pageCache.value.notifications, pageCacheOrder.notifications, page);
      if (shouldApplyNotificationsData(page)) {
        applyNotificationsData(cachedData);
      }
      void refreshUnreadNotificationCount();
      const applyToActiveList = shouldApplyNotificationsData(page);
      if (applyToActiveList && shouldEnrichNotificationSubjectStates(cachedData.items)) {
        void enrichNotificationSubjectStates(
          page,
          cachedData.items,
          activeNotificationRequestId.value,
          applyToActiveList
        );
      }
      if (!options.silent) {
        error.value = null;
        loading.value = false;
      }
      return cachedData;
    }

    const notificationRequestId = options.silent
      ? activeNotificationRequestId.value
      : activeNotificationRequestId.value + 1;
    if (!options.silent) {
      activeNotificationRequestId.value = notificationRequestId;
    }
    const requestId = options.silent ? null : activeRequestId.value + 1;
    if (!options.silent && requestId !== null) {
      activeRequestId.value = requestId;
      loading.value = true;
      error.value = null;
    }

    const shouldUseNotificationResponse = () => {
      if (notificationRequestId !== activeNotificationRequestId.value) return false;
      return requestId === null || requestId === activeRequestId.value;
    };

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardNotification>>(
        buildPaginationUrl('/api/notifications', page)
      );
      if (!shouldUseNotificationResponse()) return;

      const pendingData = {
        ...data,
        items: withPendingNotificationSubjectStates(data.items),
      };

      pageCache.value.notifications[data.pagination.page] = pendingData;
      touchCachedPage(
        pageCache.value.notifications,
        pageCacheOrder.notifications,
        data.pagination.page
      );
      const applyToActiveList = shouldApplyNotificationsData(data.pagination.page);
      if (applyToActiveList) {
        applyNotificationsData(pendingData);
      }
      if (applyToActiveList) {
        void enrichNotificationSubjectStates(
          data.pagination.page,
          pendingData.items,
          notificationRequestId,
          applyToActiveList
        );
      }
      void refreshUnreadNotificationCount();
      return pendingData;
    } catch (err) {
      if (!shouldUseNotificationResponse()) return;

      if (options.silent) {
        console.warn('Error refreshing GitHub notifications in background:', err);
      } else {
        error.value = err instanceof Error ? err.message : 'An error occurred';
      }
    } finally {
      if (requestId !== null && requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const fetchIssues = async (
    page = 1,
    options: DashboardFetchOptions = {},
    filter: DashboardListFilterInput = {}
  ) => {
    const filterKey = buildDashboardListFilterKey(filter);
    const filterCache = pageCache.value.issues[filterKey] ?? {};
    const cachedData = filterCache[page];
    if (cachedData && !options.force) {
      touchFilteredPageCache(
        pageCache.value.issues,
        pageCacheOrder.issues,
        pageCacheOrder.issuePages,
        filterKey,
        page
      );
      applyIssuesData(cachedData);
      error.value = null;
      loading.value = false;
      return cachedData;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardIssueSearchItem>>(
        buildDashboardListRequestPath('/api/issues', page, defaultPerPage, filter)
      );
      if (requestId !== activeRequestId.value) return;

      if (!pageCache.value.issues[filterKey]) {
        pageCache.value.issues[filterKey] = {};
      }
      pageCache.value.issues[filterKey][data.pagination.page] = data;
      touchFilteredPageCache(
        pageCache.value.issues,
        pageCacheOrder.issues,
        pageCacheOrder.issuePages,
        filterKey,
        data.pagination.page
      );
      applyIssuesData(data);
      return data;
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const fetchPulls = async (
    page = 1,
    options: DashboardFetchOptions = {},
    filter: DashboardListFilterInput = {}
  ) => {
    const filterKey = buildDashboardListFilterKey(filter);
    const filterCache = pageCache.value.pulls[filterKey] ?? {};
    const cachedData = filterCache[page];
    if (cachedData && !options.force) {
      touchFilteredPageCache(
        pageCache.value.pulls,
        pageCacheOrder.pulls,
        pageCacheOrder.pullPages,
        filterKey,
        page
      );
      applyPullsData(cachedData);
      error.value = null;
      loading.value = false;
      return cachedData;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardIssueSearchItem>>(
        buildDashboardListRequestPath('/api/pulls', page, defaultPerPage, filter)
      );
      if (requestId !== activeRequestId.value) return;

      if (!pageCache.value.pulls[filterKey]) {
        pageCache.value.pulls[filterKey] = {};
      }
      pageCache.value.pulls[filterKey][data.pagination.page] = data;
      touchFilteredPageCache(
        pageCache.value.pulls,
        pageCacheOrder.pulls,
        pageCacheOrder.pullPages,
        filterKey,
        data.pagination.page
      );
      applyPullsData(data);
      return data;
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const fetchRepos = async (page = 1, options: DashboardFetchOptions = {}) => {
    const cachedData = pageCache.value.repos[page];
    if (cachedData && !options.force) {
      touchCachedPage(pageCache.value.repos, pageCacheOrder.repos, page);
      applyReposData(cachedData);
      error.value = null;
      loading.value = false;
      return;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardRepositoryListItem>>(
        buildPaginationUrl('/api/repos', page)
      );
      if (requestId !== activeRequestId.value) return;

      pageCache.value.repos[data.pagination.page] = data;
      touchCachedPage(pageCache.value.repos, pageCacheOrder.repos, data.pagination.page);
      applyReposData(data);
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const fetchCustomTab = async (
    query: CustomTabQuery = {},
    page = 1,
    options: DashboardFetchOptions = {},
    source: CustomTabSource = 'github-search'
  ) => {
    const queryKey = buildCustomTabQueryKey(query, source);
    const queryCache = pageCache.value.customTabs[queryKey] ?? {};
    const cachedData = queryCache[page];

    if (cachedData && !options.force) {
      touchCustomTabCache(queryKey, page);
      applyIssuesData(cachedData);
      error.value = null;
      loading.value = false;
      return cachedData;
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;
    error.value = null;

    try {
      const data = await apiFetch<PaginatedDashboardResponse<DashboardIssueSearchItem>>(
        buildCustomTabUrl('/api/search/issues', page, query)
      );
      if (requestId !== activeRequestId.value) return;

      if (!pageCache.value.customTabs[queryKey]) {
        pageCache.value.customTabs[queryKey] = {};
      }

      pageCache.value.customTabs[queryKey][data.pagination.page] = data;
      touchCustomTabCache(queryKey, data.pagination.page);
      applyIssuesData(data);
      return data;
    } catch (err) {
      if (requestId !== activeRequestId.value) return;

      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false;
      }
    }
  };

  const markNotificationAsRead = async (threadId: PropertyKey) => {
    const normalizedThreadId = normalizeNotificationThreadId(threadId);
    if (!normalizedThreadId) {
      throw new Error('Invalid notification thread id');
    }

    await apiFetch(`/api/notifications/${encodeURIComponent(normalizedThreadId)}`, {
      method: 'PATCH',
    });
    applyReadNotification(normalizedThreadId);
    void refreshUnreadNotificationCount();
  };

  const unsubscribeNotificationThread = async (threadId: PropertyKey) => {
    const normalizedThreadId = normalizeNotificationThreadId(threadId);
    if (!normalizedThreadId) {
      throw new Error('Invalid notification thread id');
    }

    await apiFetch(
      `/api/notifications/threads/${encodeURIComponent(normalizedThreadId)}/subscription`,
      {
        method: 'DELETE',
      }
    );
    applyUnsubscribedNotification(normalizedThreadId);
  };

  const markAllNotificationsAsRead = async () => {
    await apiFetch('/api/notifications', {
      method: 'PATCH',
    });
    applyReadNotifications();
    unreadNotificationCount.value = 0;
    void refreshUnreadNotificationCount();
  };

  const markNotificationThreadsAsRead = async (threadIds: PropertyKey[]) => {
    const normalizedThreadIds = normalizeNotificationThreadIds(threadIds);
    if (!normalizedThreadIds) {
      throw new Error('Invalid notification thread ids');
    }

    if (normalizedThreadIds.length === 0) {
      return {
        items: [] as string[],
        failures: [] as MarkNotificationThreadsReadResponse['failures'],
      };
    }

    const data = await apiFetch<MarkNotificationThreadsReadResponse>('/api/notifications/threads', {
      method: 'PATCH',
      body: {
        threadIds: normalizedThreadIds,
      },
    });

    applyReadNotificationSet(data.items);
    void refreshUnreadNotificationCount();
    return data;
  };

  return {
    loading,
    error,
    notifications,
    unreadNotificationCount,
    refreshUnreadNotificationCount,
    issues,
    pulls,
    repos,
    pagination,
    stats,
    fetchNotifications,
    fetchIssues,
    fetchPulls,
    fetchRepos,
    fetchCustomTab,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    markNotificationThreadsAsRead,
    unsubscribeNotificationThread,
  };
}
