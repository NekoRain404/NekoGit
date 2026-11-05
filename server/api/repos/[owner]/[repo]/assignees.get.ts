/// Fetches assignable users for a repository.
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Normalized assignable user entry returned to the client. */
interface AssigneeItem {
  login: string;
  avatarUrl: string;
  url: string;
}

/** Fetch all users that can be assigned to issues in a repository. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const perPage = 100;
      const items: AssigneeItem[] = [];

      // GitHub caps assignees at 100 per page, so page through until a short
      // page is returned.
      for (let page = 1; ; page += 1) {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/assignees', {
          owner,
          repo,
          per_page: perPage,
          page,
        });

        for (const user of data) {
          if (!user?.login) continue;

          items.push({
            login: user.login,
            avatarUrl: user.avatar_url ?? '',
            url: user.html_url ?? '',
          });
        }

        if (data.length < perPage) {
          break;
        }
      }

      return { items };
    },
    'Failed to fetch repository assignees'
  );
});
