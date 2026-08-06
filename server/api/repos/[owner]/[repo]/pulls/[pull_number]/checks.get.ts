/// Fetches check runs and combined commit status for a pull request's head commit.
import { normalizeCheckRun, summarizeCheckRuns } from '#server/utils/ci-checks-utils';
// server/api/repos/[owner]/[repo]/pulls/[pull_number]/checks.get.ts
import { extractPullRouteParams } from '#server/utils/repo-route-utils';

interface CheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  html_url: string;
  details_url: string;
  output: { title: string; summary: string; text: string };
  app: { name: string };
}

interface ChecksApiResponse {
  check_runs: CheckRun[];
  total_count: number;
  combined_status: {
    state: string;
    statuses: Array<{ context: string; state: string; description: string | null }>;
  };
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, pullNumber } = extractPullRouteParams(event);
    const { octokit } = await getGitHubSessionContext(event);

    // Get the PR to find the head commit SHA
    const { data: pullRequest } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner,
        repo,
        pull_number: pullNumber,
      }
    );

    const headSha = pullRequest.head?.sha;
    if (!headSha) {
      return {
        check_runs: [],
        total_count: 0,
        combined_status: { state: 'pending', statuses: [] },
      } satisfies ChecksApiResponse;
    }

    // Fetch check runs for the head commit
    const { data: checkRunsData } = await octokit.request(
      'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
      {
        owner,
        repo,
        ref: headSha,
        per_page: 100,
      }
    );

    // Fetch combined status for the head commit
    const { data: combinedStatusData } = await octokit.request(
      'GET /repos/{owner}/{repo}/commits/{ref}/status',
      {
        owner,
        repo,
        ref: headSha,
      }
    );

    const normalizedRuns = checkRunsData.check_runs.map(normalizeCheckRun) as CheckRun[];

    let overallState = combinedStatusData.state;
    // Repos using only Actions check runs (no legacy commit statuses) report
    // "pending" here; derive the overall state from the check runs instead.
    if (!Array.isArray(combinedStatusData.statuses) || combinedStatusData.statuses.length === 0) {
      const summary = summarizeCheckRuns(normalizedRuns);
      overallState = summary.failing > 0
        ? 'failure'
        : summary.passing === summary.total && summary.total > 0
          ? 'success'
          : 'pending';
    }

    return {
      check_runs: normalizedRuns,
      total_count: checkRunsData.total_count,
      combined_status: {
        state: overallState,
        statuses: combinedStatusData.statuses,
      },
    } satisfies ChecksApiResponse;
  } catch (error: unknown) {
    console.error('Error fetching pull request checks:', error);
    throwGitHubRouteError(error, 'Failed to fetch pull request checks');
  }
});
