/// Creates a repository owned by the authenticated user or a selected organization.
import { executeGitHubRequest } from '#server/utils/repo-route-utils';
import { normalizeRepositoryCreateBody } from '#shared/utils/repository-create';

/** Create a repository owned by the authenticated user or the given organization. */
export default defineEventHandler(async (event) => {
  const payload = normalizeRepositoryCreateBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const common = {
        name: payload.name,
        description: payload.description,
        homepage: payload.homepage,
        private: payload.private,
        auto_init: payload.auto_init,
      };

      if (payload.owner) {
        const { data: repository } = await octokit.request('POST /orgs/{org}/repos', {
          org: payload.owner,
          ...common,
        });
        return repository;
      }

      const { data: repository } = await octokit.request('POST /user/repos', common);
      return repository;
    },
    'Failed to create repository'
  );
});
