import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';
/// Dismisses a pull request review with an optional message.
import {
  normalizeReviewDismissalBody,
  validateReviewDismissalId,
} from '#shared/utils/pr-review-dismiss';

/** Dismiss a pull request review. */
export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const { review_id } = event.context.params as { review_id?: string };
  const reviewId = validateReviewDismissalId(review_id);
  const { message } = normalizeReviewDismissalBody(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: review } = await octokit.request(
        'PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals',
        {
          owner,
          repo,
          pull_number: pullNumber,
          review_id: reviewId,
          event: 'DISMISS',
          message: message ?? '',
        }
      );

      return review;
    },
    'Failed to dismiss pull request review'
  );
});
