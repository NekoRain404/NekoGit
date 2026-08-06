/// Locks a GitHub issue with an optional reason.
import {
  extractIssueRouteParams,
  normalizeRequestBody,
  executeGitHubRequest,
} from '#server/utils/repo-route-utils';

const validLockReasons = ['off-topic', 'too heated', 'resolved', 'spam'] as const;

type LockReason = (typeof validLockReasons)[number];

interface LockRequestBody {
  lock_reason?: unknown;
}

function normalizeLockReason(body: unknown): LockReason | undefined {
  const requestBody = normalizeRequestBody<LockRequestBody>(body);

  if (requestBody?.lock_reason === undefined) {
    return undefined;
  }

  if (
    typeof requestBody.lock_reason !== 'string' ||
    !validLockReasons.includes(requestBody.lock_reason as LockReason)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid lock reason. Must be one of: ${validLockReasons.join(', ')}`,
    });
  }

  return requestBody.lock_reason as LockReason;
}

/** Lock a GitHub issue with an optional reason. */
export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const lockReason = normalizeLockReason(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request(
        'PUT /repos/{owner}/{repo}/issues/{issue_number}/lock',
        {
          owner,
          repo,
          issue_number: issueNumber,
          lock_reason: lockReason,
        }
      );
      return data;
    },
    'Failed to lock issue'
  );
});
