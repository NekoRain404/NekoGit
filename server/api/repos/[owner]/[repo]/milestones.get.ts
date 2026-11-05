/// Fetches open milestones for a repository.
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

/** Normalized milestone entry returned to the client. */
interface MilestoneItem {
  number: number;
  title: string;
  state: string;
  dueOn: string | null;
  url: string;
}

/** Fetch all open milestones defined on a repository. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const perPage = 100;
      const items: MilestoneItem[] = [];

      // GitHub caps milestones at 100 per page, so page through until a short
      // page is returned.
      for (let page = 1; ; page += 1) {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/milestones', {
          owner,
          repo,
          state: 'open',
          per_page: perPage,
          page,
        });

        for (const milestone of data) {
          items.push({
            number: milestone.number,
            title: milestone.title,
            state: milestone.state,
            dueOn: milestone.due_on ?? null,
            url: milestone.html_url ?? '',
          });
        }

        if (data.length < perPage) {
          break;
        }
      }

      return { items };
    },
    'Failed to fetch repository milestones'
  );
});
