/// PUT Issues / Labels Put
import {
  extractIssueRouteParams,
  normalizeRequestBody,
  executeGitHubRequest,
} from '#server/utils/repo-route-utils';

interface LabelsRequestBody {
  labels?: unknown;
}

function normalizeLabelsBody(body: unknown) {
  const requestBody = normalizeRequestBody<LabelsRequestBody>(body, ['labels']);

  const rawLabels = Array.isArray(requestBody!.labels)
    ? requestBody!.labels
    : requestBody!.labels
      ? [requestBody!.labels]
      : [];

  if (!rawLabels.every((label): label is string => typeof label === 'string')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid labels: all labels must be strings',
    });
  }

  return rawLabels;
}

/** Replace the full set of labels on a GitHub issue. */
export default defineEventHandler(async (event) => {
  const { owner, repo, issueNumber } = extractIssueRouteParams(event);
  const labels = normalizeLabelsBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: updatedLabels } = await octokit.request(
        'PUT /repos/{owner}/{repo}/issues/{issue_number}/labels',
        { owner, repo, issue_number: issueNumber, labels }
      );
      return updatedLabels;
    },
    'Failed to update issue labels'
  );
});
