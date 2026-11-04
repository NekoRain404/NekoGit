/// Lists organizations the authenticated user belongs to.
import { executeGitHubRequest } from '#server/utils/repo-route-utils';

interface GitHubOrganization {
  login?: string;
  avatar_url?: string;
  description?: string | null;
}

/** List organizations available as repository owners. */
export default defineEventHandler(async (event) => {
  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: organizations } = await octokit.request('GET /user/orgs', {
        per_page: 100,
      });
      const items = (organizations as GitHubOrganization[])
        .filter((organization) => Boolean(organization.login))
        .map((organization) => ({
          login: organization.login ?? '',
          avatar_url: organization.avatar_url ?? '',
          description: organization.description ?? null,
        }))
        .sort((left, right) => left.login.localeCompare(right.login));

      return { items };
    },
    'Failed to fetch organizations'
  );
});
