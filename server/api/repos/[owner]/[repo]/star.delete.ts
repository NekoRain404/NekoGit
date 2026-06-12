/// DELETE Repos / Star Delete
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Remove the authenticated user's star from a repository. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      await octokit.request('DELETE /user/starred/{owner}/{repo}', { owner, repo });
      return { success: true };
    },
    'Failed to unstar repository'
  );
});
