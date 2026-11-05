/// Searches issues involving the authenticated user via GitHub Search API.
import {
  buildInvolvesSearchQuery,
  normalizeDashboardListFilter,
} from '#shared/utils/dashboard-list-filter';

import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

// GitHub search API caps total_count at 1000 regardless of actual matches
const SEARCH_TOTAL_COUNT_LIMIT = 1000;

/** Search issues involving the authenticated user from the past year. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const createdDate = getOneYearAgoDate();
    const query = getQuery(event);
    const page = parsePaginationNumber(query.page, 1);
    const perPage = parsePaginationNumber(query.per_page, 20, 100);
    const filter = normalizeDashboardListFilter({ state: query.state });

    const q = buildInvolvesSearchQuery({
      type: 'issues',
      createdAfter: createdDate,
      userLogin,
      filter,
    });

    const { data, headers } = await octokit.request('GET /search/issues', {
      q,
      sort: 'updated',
      order: 'desc',
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
    throwGitHubRouteError(error, 'Failed to fetch issues');
  }
});
