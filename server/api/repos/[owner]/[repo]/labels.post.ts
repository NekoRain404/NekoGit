import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
/// Creates a label in a GitHub repository.
import { normalizeLabelCreateBody } from '#shared/utils/label-create';

/** Create a label in a GitHub repository. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const payload = normalizeLabelCreateBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: label } = await octokit.request('POST /repos/{owner}/{repo}/labels', {
        owner,
        repo,
        name: payload.name,
        color: payload.color,
        description: payload.description,
      });
      return label;
    },
    'Failed to create repository label'
  );
});
