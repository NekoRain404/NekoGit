/// Posts a new comment on a GitHub issue.
import {
  extractIssueRouteParams,
  normalizeRequestBody,
  validateRequiredString,
  executeGitHubRequest,
} from '#server/utils/repo-route-utils';

interface CommentRequestBody {
  body?: unknown;
}

function normalizeCommentBody(body: unknown) {
  const requestBody = normalizeRequestBody<CommentRequestBody>(body);
  return typeof requestBody?.body === 'string' ? requestBody.body.trim() : '';
}

/** Post a new comment on a GitHub issue. */
export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const commentBody = validateRequiredString(
    normalizeCommentBody(await readBody(event)),
    'Comment body'
  );

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: comment } = await octokit.request(
        'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
        { owner, repo, issue_number: issueNumber, body: commentBody }
      );
      return comment;
    },
    'Failed to create comment'
  );
});
