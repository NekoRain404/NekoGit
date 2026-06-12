/// PUT Repos / Star Put
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Star a repository on behalf of the authenticated user. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      await octokit.request('PUT /user/starred/{owner}/{repo}', { owner, repo });
      return { success: true };
    },
    'Failed to star repository'
  );
});
