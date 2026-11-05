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

/** Default freshness window for cached reviewer summaries. */
const PR_REVIEWER_SUMMARY_CACHE_TTL_MS = 45_000;

/** Options for the reviewer summary TTL cache. */
export interface PRReviewerSummaryCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

/** Keyed TTL cache with in-flight request deduplication. */
export interface PRReviewerSummaryCache<T> {
  load: (key: string, loader: () => Promise<T>) => Promise<T>;
  invalidate: (key: string) => void;
}

/** Build the cache key for a pull request reviewer summary. */
export const getPRReviewerSummaryCacheKey = (owner: string, repo: string, pullNumber: number) =>
  `${owner}/${repo}/${pullNumber}`;

/**
 * Create a small TTL cache that coalesces concurrent loads and drops in-flight
 * responses that were invalidated while they were still pending.
 */
export function createPRReviewerSummaryCache<T>(
  options: PRReviewerSummaryCacheOptions = {}
): PRReviewerSummaryCache<T> {
  const ttlMs = options.ttlMs ?? PR_REVIEWER_SUMMARY_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const entries = new Map<string, { value: T; expiresAt: number }>();
  const pending = new Map<string, Promise<T>>();
  let generation = 0;

  const load = (key: string, loader: () => Promise<T>) => {
    const cachedEntry = entries.get(key);

    if (cachedEntry && cachedEntry.expiresAt > now()) {
      return Promise.resolve(cachedEntry.value);
    }

    if (cachedEntry) {
      entries.delete(key);
    }

    const pendingLoad = pending.get(key);
    if (pendingLoad) {
      return pendingLoad;
    }

    const loadGeneration = generation;
    const promise: Promise<T> = loader().then(
      (value) => {
        if (pending.get(key) === promise) {
          pending.delete(key);
        }

        // A mutation invalidated this key while the request was in flight, so
        // the response may predate it; never let it repopulate the cache.
        if (generation === loadGeneration) {
          entries.set(key, { value, expiresAt: now() + ttlMs });
        }

        return value;
      },
      (error: unknown) => {
        if (pending.get(key) === promise) {
          pending.delete(key);
        }

        throw error;
      }
    );

    pending.set(key, promise);
    return promise;
  };

  const invalidate = (key: string) => {
    generation += 1;
    entries.delete(key);
    pending.delete(key);
  };

  return { load, invalidate };
}

/** Shared reviewer summary cache; never shared across SSR sessions. */
const reviewerSummaryCache = createPRReviewerSummaryCache<PRReviewersSummary>();

/** Fetch, request, and remove PR reviewers via the NekoGit API. */
export function usePRReviewers() {
  const apiFetch = useNekoGitApiFetch();

  const fetchReviewerSummary = (owner: string, repo: string, pullNumber: number) => {
    const loadSummary = () =>
      apiFetch<PRReviewersSummary>(`/api/pulls/${owner}/${repo}/${pullNumber}/reviewers`, {
        method: 'GET',
      });

    // The module cache is process-global on the server, but reviewer summaries
    // depend on the requesting session; keep caching client-side only.
    if (import.meta.server) {
      return loadSummary();
    }

    return reviewerSummaryCache.load(
      getPRReviewerSummaryCacheKey(owner, repo, pullNumber),
      loadSummary
    );
  };

  const fetchReviewerCandidates = (owner: string, repo: string, pullNumber: number, query = '') =>
    apiFetch<PRReviewerCandidatesResponse>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/reviewers/candidates`,
      {
        method: 'GET',
        query: query ? { q: query } : undefined,
      }
    );

  const requestReviewers = async (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRReviewerMutationPayload
  ) => {
    const response = await apiFetch<PRReviewerMutationResponse>(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/reviewers`,
      {
        method: 'POST',
        body: payload,
      }
    );

    reviewerSummaryCache.invalidate(getPRReviewerSummaryCacheKey(owner, repo, pullNumber));
    return response;
  };

  const removeReviewers = async (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRReviewerMutationPayload
  ) => {
    const response = await apiFetch<PRReviewerMutationResponse>(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/reviewers`,
      {
        method: 'DELETE',
        body: payload,
      }
    );

    reviewerSummaryCache.invalidate(getPRReviewerSummaryCacheKey(owner, repo, pullNumber));
    return response;
  };

  return {
    fetchReviewerSummary,
    fetchReviewerCandidates,
    requestReviewers,
    removeReviewers,
  };
}
