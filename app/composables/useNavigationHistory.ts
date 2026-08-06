/// In-app navigation history stack supporting back, forward, and home navigation across dashboard pages.
import { computed } from 'vue';

import type { PullRequestDashboardView } from '~/utils/dashboard-url-navigation-utils';

/** Discriminated union of navigable page types in the dashboard. */
export type PageType =
  | 'dashboard'
  | 'issue'
  | 'pull-request'
  | 'discussion'
  | 'repository'
  | 'notification'
  | 'file';

/** A single entry in the navigation history stack. */
export interface NavigationEntry {
  type: PageType;
  data?: {
    owner?: string;
    repo?: string;
    number?: number;
    tab?: string;
    path?: string;
    branch?: string;
    view?: PullRequestDashboardView;
  };
}

/** Check whether two navigation entries refer to the same page and data. */
const isSameEntry = (left: NavigationEntry | null, right: NavigationEntry) => {
  return (
    left?.type === right.type &&
    left.data?.owner === right.data?.owner &&
    left.data?.repo === right.data?.repo &&
    left.data?.number === right.data?.number &&
    left.data?.tab === right.data?.tab &&
    left.data?.path === right.data?.path &&
    left.data?.branch === right.data?.branch &&
    left.data?.view === right.data?.view
  );
};

/** In-memory navigation stack with back/forward/go-to-home support for the dashboard. */
export function useNavigationHistory() {
  const navigationHistory = useState<NavigationEntry[]>('nekogit-navigation-history', () => []);
  const forwardHistory = useState<NavigationEntry[]>(
    'nekogit-navigation-forward-history',
    () => []
  );
  const currentEntry = useState<NavigationEntry | null>('nekogit-navigation-current', () => null);

  const hasHistory = computed(() => navigationHistory.value.length > 0);
  const hasForwardHistory = computed(() => forwardHistory.value.length > 0);

  const previousEntry = computed(() => {
    if (navigationHistory.value.length > 0) {
      return navigationHistory.value[navigationHistory.value.length - 1];
    }
    return null;
  });

  const canGoBack = computed(() => hasHistory.value);
  const canGoForward = computed(() => hasForwardHistory.value);

  const shouldShowHomeButton = computed(() => {
    if (!currentEntry.value) return false;
    if (!hasHistory.value) return false;
    return previousEntry.value?.type !== 'dashboard';
  });

  const pushEntry = (entry: NavigationEntry) => {
    if (isSameEntry(currentEntry.value, entry)) {
      currentEntry.value = entry;
      return;
    }

    if (currentEntry.value) {
      navigationHistory.value.push(currentEntry.value);
    } else {
      navigationHistory.value.push({
        type: 'dashboard',
      });
    }
    forwardHistory.value = [];
    currentEntry.value = entry;
  };

  const replaceWithEntry = (entry: NavigationEntry) => {
    navigationHistory.value = [];
    forwardHistory.value = [];
    currentEntry.value = entry;
  };

  const navigateToDashboard = (tab?: string) => {
    const entry: NavigationEntry = {
      type: 'dashboard',
      data: { tab },
    };
    pushEntry(entry);
  };

  const navigateToIssue = (owner: string, repo: string, number: number, tab?: string) => {
    const entry: NavigationEntry = {
      type: 'issue',
      data: { owner, repo, number, tab },
    };
    pushEntry(entry);
  };

  const navigateToPullRequest = (
    owner: string,
    repo: string,
    number: number,
    tab?: string,
    view?: PullRequestDashboardView
  ) => {
    const entry: NavigationEntry = {
      type: 'pull-request',
      data: { owner, repo, number, tab, view },
    };
    pushEntry(entry);
  };

  const navigateToDiscussion = (owner: string, repo: string, number: number, tab?: string) => {
    const entry: NavigationEntry = {
      type: 'discussion',
      data: { owner, repo, number, tab },
    };
    pushEntry(entry);
  };

  const navigateToRepo = (owner: string, repo: string, tab?: string, branch?: string) => {
    const entry: NavigationEntry = {
      type: 'repository',
      data: { owner, repo, tab, branch },
    };
    pushEntry(entry);
  };

  const navigateToFile = (owner: string, repo: string, path: string, branch?: string) => {
    const entry: NavigationEntry = {
      type: 'file',
      data: { owner, repo, path, branch },
    };

    if (currentEntry.value?.type === 'file') {
      currentEntry.value = entry;
      return;
    }

    pushEntry(entry);
  };

  const navigateToNotification = (tab?: string) => {
    const entry: NavigationEntry = {
      type: 'notification',
      data: { tab },
    };
    pushEntry(entry);
  };

  const goBack = () => {
    if (navigationHistory.value.length === 0) {
      currentEntry.value = {
        type: 'dashboard',
      };
      return null;
    }

    if (currentEntry.value) {
      forwardHistory.value.push(currentEntry.value);
    }

    const prev = navigationHistory.value.pop()!;
    currentEntry.value = prev;
    return prev;
  };

  const goForward = () => {
    if (forwardHistory.value.length === 0) {
      return null;
    }

    if (currentEntry.value) {
      navigationHistory.value.push(currentEntry.value);
    } else {
      navigationHistory.value.push({
        type: 'dashboard',
      });
    }

    const next = forwardHistory.value.pop()!;
    currentEntry.value = next;
    return next;
  };

  const goToHome = () => {
    const homeEntry: NavigationEntry = {
      type: 'dashboard',
    };
    navigationHistory.value = [];
    forwardHistory.value = [];
    currentEntry.value = homeEntry;
    return homeEntry;
  };

  const cameFromIssueOrPR = computed(() => {
    return navigationHistory.value.some(
      (entry) => entry.type === 'issue' || entry.type === 'pull-request'
    );
  });

  const cameFromRepo = computed(() => {
    return navigationHistory.value.some((entry) => entry.type === 'repository');
  });

  const clearHistory = () => {
    navigationHistory.value = [];
    forwardHistory.value = [];
  };

  const reset = () => {
    navigationHistory.value = [];
    forwardHistory.value = [];
    currentEntry.value = null;
  };

  return {
    navigationHistory,
    forwardHistory,
    currentEntry,
    previousEntry,
    hasHistory,
    hasForwardHistory,
    canGoBack,
    canGoForward,
    shouldShowHomeButton,
    cameFromIssueOrPR,
    cameFromRepo,
    pushEntry,
    replaceWithEntry,
    navigateToDashboard,
    navigateToIssue,
    navigateToPullRequest,
    navigateToDiscussion,
    navigateToRepo,
    navigateToFile,
    navigateToNotification,
    goBack,
    goForward,
    goToHome,
    clearHistory,
    reset,
  };
}
