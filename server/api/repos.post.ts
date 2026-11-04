/// Creates a personal repository for the authenticated GitHub user.
import { executeGitHubRequest } from '#server/utils/repo-route-utils';
import { normalizeRepositoryCreateBody } from '#shared/utils/repository-create';

/** Create a repository owned by the authenticated user. */
export default defineEventHandler(async (event) => {
  const payload = normalizeRepositoryCreateBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: repository } = await octokit.request('POST /user/repos', {
        name: payload.name,
        description: payload.description,
        homepage: payload.homepage,
        private: payload.private,
        auto_init: payload.auto_init,
      });
      return repository;
    },
    'Failed to create repository'
  );
});
