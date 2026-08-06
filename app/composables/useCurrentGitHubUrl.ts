/// Resolves and tracks the current GitHub URL and repository derived from the active dashboard route.
import { computed } from 'vue';

import {
  buildCurrentGitHubRouteKey,
  buildGitHubUrlFromDashboardRoute,
  normalizeCurrentGitHubUrl,
  resolveCurrentGitHubRepository,
} from '~/utils/current-github-url-utils';

interface ScopedCurrentGitHubUrl {
  routeKey: string;
  url: string;
}

/** Resolve and track the current GitHub URL derived from the active dashboard route. */
export function useCurrentGitHubUrl() {
  const route = useRoute();
  const scopedUrl = useState<ScopedCurrentGitHubUrl | null>(
    'nekogit:current-github-url',
    () => null
  );

  const currentRouteKey = computed(() =>
    buildCurrentGitHubRouteKey({
      path: route.path,
      query: route.query,
    })
  );

  const currentGitHubUrl = computed(() => {
    if (scopedUrl.value?.routeKey === currentRouteKey.value) {
      return scopedUrl.value.url;
    }

    return buildGitHubUrlFromDashboardRoute({
      path: route.path,
      query: route.query,
    });
  });
  const currentGitHubRepository = computed(() =>
    resolveCurrentGitHubRepository(currentGitHubUrl.value)
  );

  const setCurrentGitHubUrl = (url: string | null | undefined) => {
    const normalizedUrl = normalizeCurrentGitHubUrl(url);
    scopedUrl.value = normalizedUrl
      ? {
          routeKey: currentRouteKey.value,
          url: normalizedUrl,
        }
      : null;
  };

  const clearCurrentGitHubUrl = () => {
    scopedUrl.value = null;
  };

  return {
    currentGitHubUrl,
    currentGitHubRepository,
    setCurrentGitHubUrl,
    clearCurrentGitHubUrl,
  };
}
