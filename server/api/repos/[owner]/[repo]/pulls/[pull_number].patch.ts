// server/api/repos/[owner]/[repo]/pulls/[pull_number].patch.ts
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

interface UpdatePullRequestBody {
  state?: 'closed' | 'open';
  merge?: boolean;
  merge_method?: 'merge' | 'squash' | 'rebase';
}

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = await readBody<UpdatePullRequestBody>(event);

  if (!body || (!body.state && !body.merge)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'state or merge is required',
    });
  }

  return executeGitHubRequest(
    event,
    async (octokit) => {
      if (body.merge) {
        const { data: pr } = await octokit.request(
          'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
          {
            owner,
            repo,
            pull_number: pullNumber,
            merge_method: body.merge_method ?? 'merge',
          }
        );
        return pr;
      }

      const { data: pr } = await octokit.request(
        'PATCH /repos/{owner}/{repo}/pulls/{pull_number}',
        {
          owner,
          repo,
          pull_number: pullNumber,
          state: body.state,
        }
      );
      return pr;
    },
    'Failed to update pull request'
  );
});
