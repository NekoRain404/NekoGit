/// Updates repository settings (description, homepage, visibility, archive state).
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
import { normalizeRepositorySettingsUpdate } from '#shared/utils/repository-settings';

/** Update repository settings for the given owner/repo. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const payload = normalizeRepositorySettingsUpdate(await readBody(event));
  const updates: {
    description?: string;
    homepage?: string;
    private?: boolean;
    archived?: boolean;
  } = {};
  // GitHub clears text settings with an empty string rather than null.
  if (payload.description !== undefined) updates.description = payload.description ?? '';
  if (payload.homepage !== undefined) updates.homepage = payload.homepage ?? '';
  if (payload.private !== undefined) updates.private = payload.private;
  if (payload.archived !== undefined) updates.archived = payload.archived;

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: repository } = await octokit.request('PATCH /repos/{owner}/{repo}', {
        owner,
        repo,
        ...updates,
      });
      return repository;
    },
    'Failed to update repository settings'
  );
});
