/// GET Api / Discussions
import { fetchDiscussion } from '#server/utils/github-discussion-utils';
import { executeGitHubRequest, extractDiscussionRouteParams } from '#server/utils/repo-route-utils';

/** Fetch a single GitHub Discussion by number, including its accepted answer. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo, discussionNumber } = extractDiscussionRouteParams(event);

  return executeGitHubRequest(
    event,
    (octokit) => fetchDiscussion(octokit, owner, repo, discussionNumber),
    'Failed to fetch discussion'
  );
});
