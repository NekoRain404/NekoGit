/// Returns the authenticated user's total unread notification count.
import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { parseLinkHeader } from '#server/utils/github-pagination';

const NOTIFICATIONS_PER_PAGE = 50;
const MAX_UNREAD_PAGES = 20;

/** Fetch all unread notification pages and return the exact count (capped at 1000). */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const octokit = await getGitHubClient(event);
    let page = 1;
    let count = 0;

    while (page <= MAX_UNREAD_PAGES) {
      const { data, headers } = await octokit.request('GET /notifications', {
        all: false,
        per_page: NOTIFICATIONS_PER_PAGE,
        page,
      });

      count += Array.isArray(data) ? data.length : 0;

      if (data.length < NOTIFICATIONS_PER_PAGE || !parseLinkHeader(headers.link).next) {
        return { count, truncated: false };
      }

      page += 1;
    }

    return { count, truncated: true };
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    throwGitHubRouteError(error, 'Failed to fetch unread notification count');
  }
});
