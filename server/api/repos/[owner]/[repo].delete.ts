/// Deletes a repository after the caller confirms its exact name.
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
import { normalizeRepositoryDeleteConfirmation } from '#shared/utils/repository-settings';

/** Delete the given repository after validating the typed confirmation name. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  normalizeRepositoryDeleteConfirmation(await readBody(event), repo);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      await octokit.request('DELETE /repos/{owner}/{repo}', { owner, repo });
      return { deleted: true, owner, repo };
    },
    'Failed to delete repository'
  );
});
