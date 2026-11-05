import { extractIssueRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
/// Updates a GitHub issue's title, body, or state (open/closed).
import { normalizeIssueUpdateBody } from '#shared/utils/issue-update';

/** Update a GitHub issue's title, body, or state. */
export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const payload = normalizeIssueUpdateBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: issue } = await octokit.request(
        'PATCH /repos/{owner}/{repo}/issues/{issue_number}',
        {
          owner,
          repo,
          issue_number: issueNumber,
          ...payload,
        }
      );
      return issue;
    },
    'Failed to update issue'
  );
});
