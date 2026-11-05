/// Fetches all labels defined on a repository.
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Fetch all labels defined on a repository. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const perPage = 100;
      const labels = [];

      // GitHub returns at most `per_page` labels per request (30 by default),
      // so page through until a short page is returned.
      for (let page = 1; ; page += 1) {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/labels', {
          owner,
          repo,
          per_page: perPage,
          page,
        });

        labels.push(...data);

        if (data.length < perPage) {
          break;
        }
      }

      return labels;
    },
    'Failed to fetch repository labels'
  );
});
