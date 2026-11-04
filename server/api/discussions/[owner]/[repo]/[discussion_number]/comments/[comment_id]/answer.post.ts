import {
  setDiscussionCommentAnswer,
  validateDiscussionNodeId,
} from '#server/utils/github-discussion-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';
/// Marks or unmarks a discussion comment as the accepted answer.
import { normalizeDiscussionAnswerAction } from '#shared/utils/discussion-actions';

/** Mark or unmark a discussion comment as the accepted answer. */
export default defineEventHandler(async (event) => {
  extractDiscussionRouteParams(event);

  const { comment_id } = event.context.params as { comment_id?: string };
  const commentId = validateDiscussionNodeId(comment_id, 'Discussion comment ID');
  const answered = normalizeDiscussionAnswerAction(await readBody(event));

  return executeGitHubRequest(
    event,
    (octokit) => setDiscussionCommentAnswer(octokit, commentId, answered),
    answered ? 'Failed to mark discussion comment as answer' : 'Failed to unmark discussion answer'
  );
});
