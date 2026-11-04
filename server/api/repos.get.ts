/// Lists the authenticated user's repositories sorted by recent updates.
import { computeRepositoryTotalCount } from '#shared/utils/github-repository-pagination';

import { buildLinkedPaginationMeta, parsePaginationNumber } from '../utils/github-pagination';

/** Fetch paginated repositories the authenticated user can access. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const page = parsePaginationNumber(getQuery(event).page, 1);
  const perPage = parsePaginationNumber(getQuery(event).per_page, 20, 100);

  try {
    const { data: repos, headers } = await octokit.request('GET /user/repos', {
      type: 'all',
      sort: 'updated',
      direction: 'desc',
      page,
      per_page: perPage,
    });

    const basePagination = buildLinkedPaginationMeta({
      page,
      perPage,
      linkHeader: headers.link,
    });
    const lastPage = basePagination.totalPages ?? page;
    let totalCount: number | null;

    if (lastPage === page) {
      totalCount = computeRepositoryTotalCount({
        page,
        perPage,
        lastPage,
        lastPageCount: repos.length,
      });
    } else {
      // `/user/repos` does not return a total count; fetch only the last page
      // at the same page size to derive the exact total. This is best-effort:
      // a failed auxiliary request must not fail the whole repository list.
      try {
        const { data: lastPageRepos } = await octokit.request('GET /user/repos', {
          type: 'all',
          sort: 'updated',
          direction: 'desc',
          page: lastPage,
          per_page: perPage,
        });
        totalCount = computeRepositoryTotalCount({
          page,
          perPage,
          lastPage,
          lastPageCount: lastPageRepos.length,
        });
      } catch (error) {
        console.warn('Failed to derive repository total count:', error);
        totalCount = null;
      }
    }

    return {
      items: repos,
      total_count: totalCount,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
        totalCount,
      }),
    };
  } catch (error) {
    throwGitHubRouteError(error, 'Failed to fetch repositories');
  }
});
