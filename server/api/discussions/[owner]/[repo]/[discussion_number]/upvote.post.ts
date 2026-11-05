import { fetchDiscussionNodeId, setDiscussionUpvote } from '#server/utils/github-discussion-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';
/// Adds or removes the viewer's upvote on a GitHub Discussion.
import { normalizeDiscussionUpvoteAction } from '#shared/utils/discussion-actions';

/** Add or remove the viewer's upvote on a GitHub Discussion. */
export default defineEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);
  const upvoted = normalizeDiscussionUpvoteAction(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const discussionId = await fetchDiscussionNodeId(octokit, owner, repo, discussionNumber);

      return setDiscussionUpvote(octokit, discussionId, upvoted);
    },
    upvoted ? 'Failed to upvote discussion' : 'Failed to remove discussion upvote'
  );
});
