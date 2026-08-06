/// Wires desktop back/forward/home navigation actions to the in-app navigation history stack.
import type { LocationQueryRaw } from 'vue-router';

import { buildDashboardQueryFromNavigationEntry } from '~/utils/dashboard-url-navigation-utils';

/** Desktop-level navigation action dispatched from the native window chrome. */
export type DesktopNavigationAction = 'back' | 'forward' | 'home';

/** Extract the first string from a query value that may be an array. */
const getFirstStringValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }

  return typeof value === 'string' ? value : undefined;
};

/** Strip nullish/empty values from a query object for clean URL serialization. */
const buildDashboardQuery = (query: LocationQueryRaw) => {
  const nextQuery: LocationQueryRaw = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      nextQuery[key] = value;
    }
  }

  return nextQuery;
};

/** Wire desktop back/forward/home navigation to the in-app navigation history stack. */
export function useDesktopNavigation() {
  const localePath = useLocalePath();
  const route = useRoute();
  const router = useRouter();
  const { currentEntry, goBack, goForward, goToHome } = useNavigationHistory();

  const navigateToDashboardEntry = async (entry: typeof currentEntry.value) => {
    if (!entry || entry.type === 'dashboard' || entry.type === 'notification') {
      await router.push(localePath('/dashboard'));
      return;
    }

    const currentTab = getFirstStringValue(route.query.tab);
    const query = buildDashboardQueryFromNavigationEntry(entry, {
      defaultTab: currentTab,
      repositoryTab: currentTab ?? 'repos',
    });

    if (query) {
      await router.push({
        path: localePath('/dashboard'),
        query: buildDashboardQuery(query),
      });
      return;
    }

    await router.push(localePath('/dashboard'));
  };

  const navigateBack = async () => {
    const previousEntry = goBack();
    if (previousEntry) {
      await navigateToDashboardEntry(previousEntry);
      return true;
    }

    if (router.options.history.state.back) {
      router.back();
      return true;
    }

    await router.push(localePath('/dashboard'));
    return true;
  };

  const navigateForward = async () => {
    const nextEntry = goForward();
    if (nextEntry) {
      await navigateToDashboardEntry(nextEntry);
      return true;
    }

    if (router.options.history.state.forward) {
      router.forward();
      return true;
    }

    return false;
  };

  const navigateHome = async () => {
    goToHome();
    await router.push(localePath('/dashboard'));
    return true;
  };

  const performDesktopNavigation = async (action: DesktopNavigationAction) => {
    if (action === 'back') return navigateBack();
    if (action === 'forward') return navigateForward();
    return navigateHome();
  };

  return {
    performDesktopNavigation,
    navigateBack,
    navigateForward,
    navigateHome,
  };
}
