/// Searches pull requests involving the authenticated user via GitHub Search API.
import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

// GitHub search API caps total_count at 1000 regardless of actual matches
const SEARCH_TOTAL_COUNT_LIMIT = 1000;

/** Search for open pull requests involving the authenticated user from the past year. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const createdDate = getOneYearAgoDate();
    const page = parsePaginationNumber(getQuery(event).page, 1);
    const perPage = parsePaginationNumber(getQuery(event).per_page, 20, 100);

    const q = [
      'is:pr',
      'is:open',
      'archived:false',
      `created:>=${createdDate}`,
      `involves:${userLogin}`,
      'sort:updated-desc',
    ].join(' ');

    const { data, headers } = await octokit.request('GET /search/issues', {
      q,
      page,
      per_page: perPage,
    });

    const totalCount = Math.min(data.total_count ?? 0, SEARCH_TOTAL_COUNT_LIMIT);

    return {
      total_count: totalCount,
      items: data.items,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
        totalCount,
      }),
    };
  } catch (error) {
    throwGitHubRouteError(error, 'Failed to fetch pull requests');
  }
});
