/// Checks the authenticated user's watch/subscription status for a repository.
import { hasGitHubErrorStatus } from '#server/utils/github-auth-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Get the authenticated user's subscription status for a repository. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      try {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/subscription', {
          owner,
          repo,
        });
        return { subscribed: data.subscribed, ignored: data.ignored };
      } catch (error: unknown) {
        // 404 = no subscription; 403 = insufficient token scope — return safe defaults instead of throwing
        if (hasGitHubErrorStatus(error, 404) || hasGitHubErrorStatus(error, 403)) {
          return { subscribed: false, ignored: false };
        }
        throw error;
      }
    },
    'Failed to get subscription status'
  );
});
