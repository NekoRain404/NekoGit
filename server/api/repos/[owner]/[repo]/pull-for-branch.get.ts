// server/api/repos/[owner]/[repo]/pull-for-branch.get.ts
import { extractRepoParams } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const head = getQuery(event).head;

  if (!head || typeof head !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'head query parameter is required' });
  }

  try {
    const { octokit } = await getGitHubSessionContext(event);

    const { data } = await octokit.request('GET /search/issues', {
      q: `repo:${owner}/${repo} is:pr is:open head:${head}`,
      sort: 'updated',
      order: 'desc',
      per_page: 1,
    });

    const item = data.items?.[0];
    if (!item) {
      return { pull: null };
    }

    return {
      pull: {
        number: item.number,
        title: item.title,
        state: item.state,
        html_url: item.html_url,
      },
    };
  } catch (error) {
    // Silently return null on error to avoid noise in the local repo panel
    console.error('Failed to fetch pull request for branch:', error);
    return { pull: null };
  }
});
