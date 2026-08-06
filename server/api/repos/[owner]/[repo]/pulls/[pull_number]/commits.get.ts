// server/api/repos/[owner]/[repo]/pulls/[pull_number]/commits.get.ts
import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';
import { extractPullRouteParams } from '#server/utils/repo-route-utils';

interface PullCommitResponse {
  sha?: string;
  commit?: {
    message?: string;
    author?: {
      name?: string;
      date?: string;
    };
  };
  html_url?: string;
}

const normalizePullCommit = (commit: PullCommitResponse) => ({
  sha: commit.sha ?? '',
  shortSha: (commit.sha ?? '').slice(0, 7),
  message: (commit.commit?.message ?? '').split('\n')[0] ?? '',
  authorName: commit.commit?.author?.name ?? '',
  authorDate: commit.commit?.author?.date ?? '',
  htmlUrl: commit.html_url,
});

/** Fetch all commits for a pull request (GitHub returns up to 250). */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, pullNumber } = extractPullRouteParams(event);
    const { octokit } = await getGitHubSessionContext(event);

    const commits = await fetchPaginatedArray<PullCommitResponse>(
      octokit,
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
      {
        owner,
        repo,
        pull_number: pullNumber,
      }
    );

    return {
      items: commits.map(normalizePullCommit),
    };
  } catch (error: unknown) {
    console.error('Error fetching pull request commits:', error);
    throwGitHubRouteError(error, 'Failed to fetch pull request commits');
  }
});
