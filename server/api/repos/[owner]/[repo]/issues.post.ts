import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
/// Creates a new issue in a GitHub repository.
import { normalizeIssueCreateBody } from '#shared/utils/issue-create';

/** Create a new issue in a GitHub repository. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const payload = normalizeIssueCreateBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: issue } = await octokit.request('POST /repos/{owner}/{repo}/issues', {
        owner,
        repo,
        title: payload.title,
        body: payload.body,
      });
      return issue;
    },
    'Failed to create issue'
  );
});
