/// Transfers a repository to another user or organization.
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
import { normalizeRepositoryTransferBody } from '#shared/utils/repository-transfer';

/** Transfer the given repository to a new owner. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const { new_owner } = normalizeRepositoryTransferBody(await readBody(event), owner);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: repository } = await octokit.request('POST /repos/{owner}/{repo}/transfer', {
        owner,
        repo,
        new_owner,
      });
      return repository;
    },
    'Failed to transfer repository'
  );
});
