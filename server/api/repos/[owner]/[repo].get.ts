/// GET Api / Repos
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Fetch repository metadata by owner and repo name. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      });
      return repository;
    },
    'Failed to fetch repository details'
  );
});
