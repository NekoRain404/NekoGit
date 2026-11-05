import { fetchDiscussionNodeId, setDiscussionLocked } from '#server/utils/github-discussion-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';
/// Locks or unlocks a GitHub Discussion with an optional reason.
import { normalizeDiscussionLockAction } from '#shared/utils/discussion-actions';

/** Lock or unlock a GitHub Discussion with an optional reason. */
export default defineEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);
  const { locked, reason } = normalizeDiscussionLockAction(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const discussionId = await fetchDiscussionNodeId(octokit, owner, repo, discussionNumber);

      return setDiscussionLocked(octokit, discussionId, locked, reason);
    },
    locked ? 'Failed to lock discussion' : 'Failed to unlock discussion'
  );
});
