import {
  setDiscussionUpvote,
  validateDiscussionNodeId,
} from '#server/utils/github-discussion-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';
/// Adds or removes the viewer's upvote on a discussion comment.
import { normalizeDiscussionUpvoteAction } from '#shared/utils/discussion-actions';

/** Add or remove the viewer's upvote on a discussion comment. */
export default defineEventHandler(async (event) => {
  extractDiscussionRouteParams(event);

  const { comment_id } = event.context.params as { comment_id?: string };
  const commentId = validateDiscussionNodeId(comment_id, 'Discussion comment ID');
  const upvoted = normalizeDiscussionUpvoteAction(await readBody(event));

  return executeGitHubRequest(
    event,
    (octokit) => setDiscussionUpvote(octokit, commentId, upvoted),
    upvoted ? 'Failed to upvote discussion comment' : 'Failed to remove comment upvote'
  );
});
