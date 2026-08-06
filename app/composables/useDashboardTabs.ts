/// Tracks the active built-in dashboard tab and delegates refresh to the matching data fetcher.
import { ref } from 'vue';

import type { DashboardFetchOptions } from '~/composables/useGithubData';

/** One of the four built-in dashboard views. */
export type DashboardTab = 'notifications' | 'issues' | 'pulls' | 'repos';

interface DashboardTabFetchers {
  fetchNotifications: (page?: number, options?: DashboardFetchOptions) => Promise<unknown>;
  fetchIssues: (page?: number, options?: DashboardFetchOptions) => Promise<unknown>;
  fetchPulls: (page?: number, options?: DashboardFetchOptions) => Promise<unknown>;
  fetchRepos: (page?: number, options?: DashboardFetchOptions) => Promise<unknown>;
  initialTab?: DashboardTab;
}

/** Track the active dashboard tab and delegate refresh to the appropriate data fetcher. */
export function useDashboardTabs({
  fetchNotifications,
  fetchIssues,
  fetchPulls,
  fetchRepos,
  initialTab = 'notifications',
}: DashboardTabFetchers) {
  const currentTab = ref<DashboardTab>(initialTab);

  const tabRefreshers: Record<
    DashboardTab,
    (page?: number, options?: DashboardFetchOptions) => Promise<unknown>
  > = {
    notifications: fetchNotifications,
    issues: fetchIssues,
    pulls: fetchPulls,
    repos: fetchRepos,
  };

  const refreshCurrentTab = async (page?: number, options?: DashboardFetchOptions) => {
    await tabRefreshers[currentTab.value](page, options);
  };

  const switchTab = async (tab: DashboardTab, page?: number, options?: DashboardFetchOptions) => {
    currentTab.value = tab;
    await refreshCurrentTab(page, options);
  };

  return {
    currentTab,
    refreshCurrentTab,
    switchTab,
  };
}
