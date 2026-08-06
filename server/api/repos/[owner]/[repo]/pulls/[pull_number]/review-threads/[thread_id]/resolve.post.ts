/// Resolves or unresolves a pull request review thread.
import {
  setPullRequestReviewThreadResolved,
  validateReviewThreadId,
} from '#server/utils/github-timeline-utils';
import {
  extractPullRouteParams,
  executeGitHubRequest,
  normalizeRequestBody,
} from '#server/utils/repo-route-utils';

interface ReviewThreadResolveRequestBody {
  resolved?: unknown;
}

function normalizeResolvedState(body: unknown) {
  const requestBody = normalizeRequestBody<ReviewThreadResolveRequestBody>(body, ['resolved']);

  if (typeof requestBody?.resolved !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'resolved must be a boolean',
    });
  }

  return requestBody.resolved;
}

/** Resolve or unresolve a pull request review thread. */
export default defineEventHandler(async (event) => {
  extractPullRouteParams(event);

  const { thread_id } = event.context.params as { thread_id?: string };
  const threadId = validateReviewThreadId(thread_id);
  const resolved = normalizeResolvedState(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const thread = await setPullRequestReviewThreadResolved(octokit, threadId, resolved);

      return { thread };
    },
    resolved ? 'Failed to resolve review thread' : 'Failed to unresolve review thread'
  );
});
