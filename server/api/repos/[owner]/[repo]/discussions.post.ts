import { createDiscussion } from '#server/utils/github-discussion-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
/// Creates a new discussion in a repository.
import { normalizeDiscussionCreateBody } from '#shared/utils/discussion-create';

/** Create a new discussion in a repository. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const payload = normalizeDiscussionCreateBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      });

      if (!repository.node_id) {
        throw createError({
          statusCode: 502,
          statusMessage: 'GitHub did not return the repository node id',
        });
      }

      const discussion = await createDiscussion(
        octokit,
        repository.node_id,
        payload.categoryId,
        payload.title,
        payload.body
      );

      return { discussion };
    },
    'Failed to create discussion'
  );
});
