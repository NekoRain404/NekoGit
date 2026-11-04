/// Reruns a specific check run for a pull request.
import { createError } from 'h3';

import { extractActionsJobId, normalizeCheckRunId } from '#server/utils/ci-checks-utils';
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

const REREQUEST_FALLBACK_STATUS_CODES = new Set([403, 404, 422]);

const NO_FALLBACK_STATUS_MESSAGE =
  'Failed to rerun check run: the check run was not created by a GitHub App and no GitHub Actions job was found';

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return null;
}

/** Rerun a check run for a pull request. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const { run_id } = event.context.params as { run_id: string };
  const runId = normalizeCheckRunId(run_id);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      try {
        // GitHub App-created check runs can be re-requested directly.
        const { data } = await octokit.request(
          'POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest',
          {
            owner,
            repo,
            check_run_id: runId,
          }
        );

        return {
          strategy: 'rerequest' as const,
          check_run_id: runId,
          data,
        };
      } catch (rerequestError: unknown) {
        const status = getErrorStatus(rerequestError);

        if (status === null || !REREQUEST_FALLBACK_STATUS_CODES.has(status)) {
          throw createError({
            statusCode: status ?? 500,
            statusMessage: 'Failed to rerun check run',
          });
        }

        // Actions check runs are not rerequestable; rerun the backing job instead.
        let jobId: number | null = null;
        try {
          const { data: checkRun } = await octokit.request(
            'GET /repos/{owner}/{repo}/check-runs/{check_run_id}',
            {
              owner,
              repo,
              check_run_id: runId,
            }
          );
          jobId = extractActionsJobId(checkRun.details_url, owner, repo);
        } catch {
          jobId = null;
        }

        if (jobId === null) {
          throw createError({
            statusCode: status,
            statusMessage: NO_FALLBACK_STATUS_MESSAGE,
          });
        }

        try {
          const { data } = await octokit.request(
            'POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun',
            {
              owner,
              repo,
              job_id: jobId,
            }
          );

          return {
            strategy: 'actions_job' as const,
            check_run_id: runId,
            job_id: jobId,
            data,
          };
        } catch (jobRerunError: unknown) {
          const jobStatus = getErrorStatus(jobRerunError);

          throw createError({
            statusCode: jobStatus ?? status,
            statusMessage:
              'Failed to rerun check run: both check run rerequest and GitHub Actions job rerun failed',
          });
        }
      }
    },
    'Failed to rerun check run'
  );
});
