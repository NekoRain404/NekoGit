/// Creates a new pull request in a repository.
// server/api/repos/[owner]/[repo]/pulls.post.ts
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

interface CreatePullRequestBody {
  head: string;
  base: string;
  title: string;
  body?: string;
}

export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const body = await readBody<CreatePullRequestBody>(event);

  if (!body?.head || !body?.base || !body?.title) {
    throw createError({ statusCode: 400, statusMessage: 'head, base, and title are required' });
  }

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: pull } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner,
        repo,
        head: body.head,
        base: body.base,
        title: body.title.trim(),
        body: body.body?.trim() || undefined,
      });
      return pull;
    },
    'Failed to create pull request'
  );
});
