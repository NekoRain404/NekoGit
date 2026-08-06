/// Creates or updates the authenticated user's subscription to a repository.
import {
  extractRepoParams,
  normalizeRequestBody,
  executeGitHubRequest,
} from '#server/utils/repo-route-utils';

interface SubscriptionRequestBody {
  subscribed?: unknown;
  ignored?: unknown;
}

/** Create or update the authenticated user's subscription to a repository. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const body = normalizeRequestBody<SubscriptionRequestBody>(await readBody(event));

  const subscribed = (body?.subscribed as boolean) ?? true;
  const ignored = (body?.ignored as boolean) ?? false;

  if (typeof subscribed !== 'boolean' || typeof ignored !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid subscription request body',
    });
  }

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request('PUT /repos/{owner}/{repo}/subscription', {
        owner,
        repo,
        subscribed,
        ignored,
      });
      return { subscribed: data.subscribed, ignored: data.ignored };
    },
    'Failed to update subscription'
  );
});
