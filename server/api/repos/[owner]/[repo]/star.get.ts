/// Checks whether the authenticated user has starred a repository.
import { hasGitHubErrorStatus } from '#server/utils/github-auth-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Check whether the authenticated user has starred a repository. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      try {
        await octokit.request('GET /user/starred/{owner}/{repo}', { owner, repo });
        return { starred: true };
      } catch (error: unknown) {
        // 404 = not starred; 403 = token may lack "repo" scope — treat both as "not starred" instead of throwing
        if (hasGitHubErrorStatus(error, 404) || hasGitHubErrorStatus(error, 403)) {
          return { starred: false };
        }
        throw error;
      }
    },
    'Failed to check star status'
  );
});
