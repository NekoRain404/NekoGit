/// GET Repos / Labels Get
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Fetch all labels defined on a repository. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: labels } = await octokit.request('GET /repos/{owner}/{repo}/labels', {
        owner,
        repo,
      });
      return labels;
    },
    'Failed to fetch repository labels'
  );
});
