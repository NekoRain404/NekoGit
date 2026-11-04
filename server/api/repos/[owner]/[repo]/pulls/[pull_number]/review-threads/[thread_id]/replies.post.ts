/// Adds a reply to an existing pull request review thread.
import {
  addPullRequestReviewThreadReply,
  validateReviewThreadId,
} from '#server/utils/github-timeline-utils';
import {
  extractPullRouteParams,
  executeGitHubRequest,
  normalizeRequestBody,
  validateRequiredString,
} from '#server/utils/repo-route-utils';

interface ReviewThreadReplyRequestBody {
  body?: unknown;
}

function normalizeReplyBody(body: unknown) {
  const requestBody = normalizeRequestBody<ReviewThreadReplyRequestBody>(body);
  return typeof requestBody?.body === 'string' ? requestBody.body.trim() : '';
}

/** Add a reply to an existing pull request review thread. */
export default defineEventHandler(async (event) => {
  extractPullRouteParams(event);

  const { thread_id } = event.context.params as { thread_id?: string };
  const threadId = validateReviewThreadId(thread_id);
  const replyBody = validateRequiredString(normalizeReplyBody(await readBody(event)), 'Reply body');

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const reply = await addPullRequestReviewThreadReply(octokit, threadId, replyBody);
      return { reply };
    },
    'Failed to reply to review thread'
  );
});
