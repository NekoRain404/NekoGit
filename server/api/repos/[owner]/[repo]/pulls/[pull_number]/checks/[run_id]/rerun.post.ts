/// Reruns a specific check run for a pull request.
import { normalizeCheckRunId } from '#server/utils/ci-checks-utils';
import {
  extractRepoParams,
  extractPullNumber,
  executeGitHubRequest,
} from '#server/utils/repo-route-utils';

/** Rerun a check run for a pull request. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const pullNumber = extractPullNumber(event);
  const { run_id } = event.context.params as { run_id: string };
  const runId = normalizeCheckRunId(run_id);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: checkRun } = await octokit.request(
        'POST /repos/{owner}/{repo}/check-runs/{run_id}/rerun',
        {
          owner,
          repo,
          run_id: runId,
        }
      );
      return checkRun;
    },
    'Failed to rerun check run'
  );
});
