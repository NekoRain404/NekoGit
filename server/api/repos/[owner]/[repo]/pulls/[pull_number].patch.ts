/// Updates a pull request's state (open/closed) or merges it.
import { normalizePullUpdateAction } from '#server/utils/pr-actions-utils';
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
  const action = normalizePullUpdateAction(body);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      if (action.type === 'merge') {
        const { data: pr } = await octokit.request(
          'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
          {
            owner,
            repo,
            pull_number: pullNumber,
            merge_method: action.mergeMethod,
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
          state: action.state,
          title: action.title,
          body: action.body,
        }
      );
      return pr;
    },
    'Failed to update pull request'
  );
});
