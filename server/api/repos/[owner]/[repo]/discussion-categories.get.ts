/// Lists the discussion categories available in a repository.
import { fetchDiscussionCategories } from '#server/utils/github-discussion-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Fetch discussion categories available in a repository. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => ({ items: await fetchDiscussionCategories(octokit, owner, repo) }),
    'Failed to fetch discussion categories'
  );
});
