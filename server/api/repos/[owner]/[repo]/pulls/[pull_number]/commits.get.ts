/// Fetches all commits for a pull request, auto-paginating through GitHub's limit.
// server/api/repos/[owner]/[repo]/pulls/[pull_number]/commits.get.ts
import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';
import { normalizePullCommit, type PullCommitResponse } from '#server/utils/pr-commits-utils';
import { extractPullRouteParams } from '#server/utils/repo-route-utils';

/** Fetch all commits for a pull request (GitHub returns up to 250). */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, pullNumber } = extractPullRouteParams(event);
    const { octokit } = await getGitHubSessionContext(event);

    const commits = await fetchPaginatedArray<PullCommitResponse>(
      octokit,
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
      {
        owner,
        repo,
        pull_number: pullNumber,
      }
    );

    return {
      items: commits.map(normalizePullCommit),
    };
  } catch (error: unknown) {
    console.error('Error fetching pull request commits:', error);
    throwGitHubRouteError(error, 'Failed to fetch pull request commits');
  }
});
