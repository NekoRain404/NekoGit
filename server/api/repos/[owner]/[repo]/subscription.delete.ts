/// Unsubscribes the authenticated user from a repository, disabling notifications.
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Delete the authenticated user's subscription (notifications) for a repository. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      await octokit.request('DELETE /repos/{owner}/{repo}/subscription', { owner, repo });
      return { success: true };
    },
    'Failed to delete subscription'
  );
});
