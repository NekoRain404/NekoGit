/// Shared filter normalization and query construction for dashboard issue/pull lists.
/** Dashboard list state filter. */
export type DashboardListState = 'open' | 'closed' | 'all';

/** Normalized state/merged filter used by the issues and pulls endpoints. */
export interface DashboardListFilter {
  state: DashboardListState;
  merged: boolean;
}

/** Loose filter input accepted from query params or composable callers. */
export interface DashboardListFilterInput {
  state?: unknown;
  merged?: unknown;
}

/** Default list filter: open items, merged flag disabled. */
export const DEFAULT_DASHBOARD_LIST_FILTER: DashboardListFilter = Object.freeze({
  state: 'open',
  merged: false,
});

/** Normalize a state query value, defaulting to open. */
export const normalizeDashboardListState = (value: unknown): DashboardListState => {
  if (value === 'closed' || value === 'all') {
    return value;
  }

  return 'open';
};

/** Normalize a merged query flag (`1`, `true`, or boolean true). */
export const normalizeMergedFilter = (value: unknown): boolean => {
  return value === true || value === 1 || value === '1' || value === 'true';
};

/** Normalize a loose list filter into a complete state/merged filter. */
export const normalizeDashboardListFilter = (
  filter: DashboardListFilterInput | undefined
): DashboardListFilter => {
  return {
    state: normalizeDashboardListState(filter?.state),
    merged: normalizeMergedFilter(filter?.merged),
  };
};

/** Stable cache key that keeps open, closed, and merged result sets apart. */
export const buildDashboardListFilterKey = (
  filter: DashboardListFilterInput | undefined
): string => {
  const normalized = normalizeDashboardListFilter(filter);
  return `state=${normalized.state}&merged=${normalized.merged ? '1' : '0'}`;
};

/** Build the client request path for one page of an issue or pull list. */
export const buildDashboardListRequestPath = (
  path: string,
  page: number,
  perPage: number,
  filter: DashboardListFilterInput | undefined
): string => {
  const normalized = normalizeDashboardListFilter(filter);
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    state: normalized.state,
  });

  if (normalized.merged) {
    searchParams.set('merged', '1');
  }

  return `${path}?${searchParams.toString()}`;
};

/** Query options for the authenticated-user issue/pull search. */
export interface InvolvesSearchQueryOptions {
  type: 'issues' | 'pulls';
  createdAfter: string;
  userLogin: string;
  filter?: DashboardListFilterInput;
}

/**
 * Build the GitHub Search API `q` value used by `/api/issues` and `/api/pulls`.
 *
 * `sort`/`order` are intentionally not included; the search endpoint expects
 * them as explicit request parameters.
 */
export const buildInvolvesSearchQuery = (options: InvolvesSearchQueryOptions): string => {
  const normalized = normalizeDashboardListFilter(options.filter);
  const parts = [options.type === 'pulls' ? 'is:pr' : 'is:issue'];

  if (normalized.state === 'open') {
    parts.push('is:open');
  } else if (normalized.state === 'closed') {
    parts.push('is:closed');
  }

  if (options.type === 'pulls' && normalized.merged) {
    parts.push('is:merged');
  }

  parts.push(
    'archived:false',
    `created:>=${options.createdAfter}`,
    `involves:${options.userLogin}`
  );

  return parts.join(' ');
};

/** Resolve active quick-filter keys into an issue list filter. */
export const resolveIssueListFilter = (
  filters: Record<string, boolean> | undefined
): DashboardListFilter => {
  const activeKeys = new Set(
    Object.entries(filters ?? {})
      .filter(([, active]) => active)
      .map(([key]) => key)
  );
  const hasOpen = activeKeys.has('open');
  const hasClosed = activeKeys.has('closed');

  if (!hasOpen && !hasClosed) {
    return { ...DEFAULT_DASHBOARD_LIST_FILTER };
  }

  if (hasOpen && hasClosed) {
    return { state: 'all', merged: false };
  }

  return { state: hasClosed ? 'closed' : 'open', merged: false };
};

/** Resolve active quick-filter keys into a pull request list filter. */
export const resolvePullListFilter = (
  filters: Record<string, boolean> | undefined
): DashboardListFilter => {
  const activeKeys = new Set(
    Object.entries(filters ?? {})
      .filter(([, active]) => active)
      .map(([key]) => key)
  );
  const hasOpen = activeKeys.has('open');
  const hasClosed = activeKeys.has('closed');
  const hasMerged = activeKeys.has('merged');

  if (hasOpen && hasClosed) {
    return { state: 'all', merged: hasMerged };
  }

  if (!hasOpen && !hasClosed) {
    return hasMerged ? { state: 'all', merged: true } : { ...DEFAULT_DASHBOARD_LIST_FILTER };
  }

  return {
    state: hasClosed ? 'closed' : 'open',
    merged: hasMerged,
  };
};
