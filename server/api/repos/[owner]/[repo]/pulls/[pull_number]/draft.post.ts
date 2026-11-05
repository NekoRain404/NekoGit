/// Converts a pull request to draft or marks it ready for review.
import { normalizePullDraftAction } from '#server/utils/pr-actions-utils';
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

interface PullRequestDraftNode {
  id?: string;
  isDraft?: boolean;
  number?: number;
}

interface PullRequestDraftMutationResponse {
  convertPullRequestToDraft?: { pullRequest?: PullRequestDraftNode | null } | null;
  markPullRequestReadyForReview?: { pullRequest?: PullRequestDraftNode | null } | null;
}

const CONVERT_TO_DRAFT_MUTATION = `
  mutation ConvertPullRequestToDraft($pullRequestId: ID!) {
    convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
      pullRequest {
        id
        isDraft
        number
      }
    }
  }
`;

const MARK_READY_FOR_REVIEW_MUTATION = `
  mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
    markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
      pullRequest {
        id
        isDraft
        number
      }
    }
  }
`;

/** Convert a pull request to draft or mark it ready for review via GraphQL. */
export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const draft = normalizePullDraftAction(await readBody(event));

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: pullRequest } = await octokit.request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}',
        {
          owner,
          repo,
          pull_number: pullNumber,
        }
      );

      if (!pullRequest.node_id) {
        throw createError({
          statusCode: 502,
          statusMessage: 'GitHub did not return the pull request node id',
        });
      }

      const response = await octokit.graphql<PullRequestDraftMutationResponse>(
        draft ? CONVERT_TO_DRAFT_MUTATION : MARK_READY_FOR_REVIEW_MUTATION,
        { pullRequestId: pullRequest.node_id }
      );
      const updatedNode = draft
        ? response.convertPullRequestToDraft?.pullRequest
        : response.markPullRequestReadyForReview?.pullRequest;

      return {
        pullRequest: {
          ...pullRequest,
          draft,
          ...(updatedNode?.id ? { node_id: updatedNode.id } : {}),
        },
      };
    },
    draft
      ? 'Failed to convert pull request to draft'
      : 'Failed to mark pull request ready for review'
  );
});
