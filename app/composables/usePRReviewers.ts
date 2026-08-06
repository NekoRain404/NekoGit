/// Aggregates pull request reviewer info into a summary of requested, approved, and pending reviewers.
export type PRReviewerKind = 'user' | 'team';

/** Review status derived from the latest submitted review. */
export type PRReviewerStatus =
  | 'requested'
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'dismissed'
  | 'pending'
  | 'unknown';

/** Aggregated reviewer info combining review status, counts, and removability. */
export interface PRReviewerSummaryItem {
  key: string;
  kind: PRReviewerKind;
  id?: string;
  nodeId?: string;
  login?: string;
  slug?: string;
  name: string;
  avatarUrl?: string | null;
  url?: string | null;
  status: PRReviewerStatus;
  rawState?: string;
  latestSubmittedAt?: string | null;
  latestCommentedAt?: string | null;
  latestReviewUrl?: string | null;
  reviewCount: number;
  commentCount: number;
  requested: boolean;
  removable: boolean;
}

/** Shape of a requested-user entry returned by the GitHub API. */
export interface PRReviewerRequestedUser {
  id?: number | string;
  node_id?: string;
  login?: string;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

/** Shape of a requested-team entry returned by the GitHub API. */
export interface PRReviewerRequestedTeam {
  id?: number | string;
  node_id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  html_url?: string | null;
  url?: string | null;
}

/** Full reviewer summary including counts and pending requests. */
export interface PRReviewersSummary {
  items: PRReviewerSummaryItem[];
  requestedUsers: PRReviewerRequestedUser[];
  requestedTeams: PRReviewerRequestedTeam[];
  counts: Record<PRReviewerStatus, number> & {
    total: number;
    users: number;
    teams: number;
  };
  warnings?: PRReviewerSummaryWarning[];
}

/** A searchable reviewer candidate eligible to be requested. */
export interface PRReviewerCandidate {
  key: string;
  kind: PRReviewerKind;
  id?: string;
  nodeId?: string;
  login?: string;
  slug?: string;
  name: string;
  avatarUrl?: string | null;
  url?: string | null;
  requested: boolean;
}

/** Response from the reviewer candidates endpoint. */
export interface PRReviewerCandidatesResponse {
  query: string;
  items: PRReviewerCandidate[];
  users: PRReviewerCandidate[];
  teams: PRReviewerCandidate[];
  warnings: PRReviewerCandidateWarning[];
  canRequestReviewers: boolean;
}

/** A non-fatal warning surfaced during reviewer summary loading. */
export interface PRReviewerSummaryWarning {
  source: 'reviewer-summary';
  message: string;
}

/** A non-fatal warning surfaced during reviewer candidate search. */
export interface PRReviewerCandidateWarning {
  source: 'requested-reviewers' | 'collaborators' | 'teams';
  message: string;
}

/** Payload sent to add or remove reviewers from a PR. */
export interface PRReviewerMutationPayload {
  reviewers?: string[];
  teamReviewers?: string[];
}

/** Response returned after mutating PR reviewers. */
export interface PRReviewerMutationResponse {
  pullRequest?: Record<string, unknown>;
  reviewers?: PRReviewersSummary;
}

/** Build a zeroed-out reviewers summary with optional warnings. */
export const createEmptyPRReviewersSummary = (
  warnings: PRReviewerSummaryWarning[] = []
): PRReviewersSummary => ({
  items: [],
  requestedUsers: [],
  requestedTeams: [],
  counts: {
    requested: 0,
    approved: 0,
    changes_requested: 0,
    commented: 0,
    dismissed: 0,
    pending: 0,
    unknown: 0,
    total: 0,
    users: 0,
    teams: 0,
  },
  warnings,
});

/** Fetch, request, and remove PR reviewers via the NekoGit API. */
export function usePRReviewers() {
  const apiFetch = useNekoGitApiFetch();

  const fetchReviewerSummary = (owner: string, repo: string, pullNumber: number) =>
    apiFetch<PRReviewersSummary>(`/api/pulls/${owner}/${repo}/${pullNumber}/reviewers`, {
      method: 'GET',
    });

  const fetchReviewerCandidates = (owner: string, repo: string, pullNumber: number, query = '') =>
    apiFetch<PRReviewerCandidatesResponse>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/reviewers/candidates`,
      {
        method: 'GET',
        query: query ? { q: query } : undefined,
      }
    );

  const requestReviewers = (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRReviewerMutationPayload
  ) =>
    apiFetch<PRReviewerMutationResponse>(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/reviewers`,
      {
        method: 'POST',
        body: payload,
      }
    );

  const removeReviewers = (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRReviewerMutationPayload
  ) =>
    apiFetch<PRReviewerMutationResponse>(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/reviewers`,
      {
        method: 'DELETE',
        body: payload,
      }
    );

  return {
    fetchReviewerSummary,
    fetchReviewerCandidates,
    requestReviewers,
    removeReviewers,
  };
}
