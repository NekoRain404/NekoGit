/// Unlocks a GitHub issue.
import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Unlock a GitHub issue. */
export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request(
        'DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock',
        {
          owner,
          repo,
          issue_number: issueNumber,
        }
      );
      return data;
    },
    'Failed to unlock issue'
  );
});
