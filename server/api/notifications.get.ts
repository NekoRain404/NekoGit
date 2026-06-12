/// Lists notifications for the authenticated user with pagination.
import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

/** Fetch paginated GitHub notifications for the authenticated user. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const page = parsePaginationNumber(getQuery(event).page, 1);
  const perPage = parsePaginationNumber(getQuery(event).per_page, 20, 50);

  try {
    const { data: notifications, headers } = await octokit.request('GET /notifications', {
      all: true,
      page,
      per_page: perPage,
    });

    return {
      items: notifications,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
      }),
    };
  } catch (error) {
    // Surface 403 with a clear hint about missing token scopes.
    const status =
      error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
        ? error.status
        : null;

    if (status === 403) {
      console.error('[notifications] 403 — token likely missing the "notifications" scope.');
    }

    throwGitHubRouteError(error, 'Failed to fetch notifications');
  }
});
