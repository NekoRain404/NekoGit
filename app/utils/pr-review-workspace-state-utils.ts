/** Composite key identifying a specific PR review workspace. */
export interface PRReviewWorkspaceStateScope {
  owner: string;
  repo: string;
  pullNumber: number;
  commitId: string;
}

/** Persisted UI state for a PR review workspace session. */
export interface PRReviewWorkspaceState {
  viewedFilenames: string[];
  showUnviewedOnly: boolean;
  fileViewMode: 'list' | 'tree';
  sidebarCollapsed: boolean;
  reviewPanelCollapsed: boolean;
  updatedAt: number;
}

/** Persisted UI state for a PR review workspace session. */
export interface PRReviewWorkspaceStateInput {
  viewedFilenames?: unknown;
  showUnviewedOnly?: unknown;
  fileViewMode?: unknown;
  sidebarCollapsed?: unknown;
  reviewPanelCollapsed?: unknown;
  updatedAt?: unknown;
}

/** LocalStorage key prefix for PR review workspace state. */
export const PR_REVIEW_WORKSPACE_STATE_STORAGE_PREFIX = 'nekogit:pr-review:workspace';
const MAX_VIEWED_FILENAMES = 2000;
const MAX_FILENAME_CHARS = 2048;

const defaultWorkspaceState = (): PRReviewWorkspaceState => ({
  viewedFilenames: [],
  showUnviewedOnly: false,
  fileViewMode: 'tree',
  sidebarCollapsed: false,
  reviewPanelCollapsed: true,
  updatedAt: 0,
});

const normalizeScopeSegment = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized ? encodeURIComponent(normalized) : null;
};

/** Builds a namespaced storage key from a PR review workspace scope. */
export function buildPRReviewWorkspaceStateStorageKey(scope: PRReviewWorkspaceStateScope) {
  const owner = normalizeScopeSegment(scope.owner);
  const repo = normalizeScopeSegment(scope.repo);
  const commitId = normalizeScopeSegment(scope.commitId);
  const pullNumber =
    Number.isSafeInteger(scope.pullNumber) && scope.pullNumber > 0 ? scope.pullNumber : null;

  if (!owner || !repo || !pullNumber || !commitId) {
    return null;
  }

  return `${PR_REVIEW_WORKSPACE_STATE_STORAGE_PREFIX}:${owner}/${repo}/${pullNumber}/${commitId}`;
}

const normalizeViewedFilenames = (value: unknown, allowedFilenames?: Set<string>) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const filenames: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const filename = item.trim();
    if (
      !filename ||
      filename.length > MAX_FILENAME_CHARS ||
      seen.has(filename) ||
      (allowedFilenames && !allowedFilenames.has(filename)) // optionally restrict to known filenames in the PR
    ) {
      continue;
    }

    seen.add(filename);
    filenames.push(filename);

    if (filenames.length >= MAX_VIEWED_FILENAMES) {
      break;
    }
  }

  return filenames;
};

const normalizeUpdatedAt = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
};

/**
 * Coerces raw input into a valid PRReviewWorkspaceState, applying defaults
 * and bounds.
 */
export function normalizePRReviewWorkspaceState(
  value: unknown,
  allowedFilenames?: Set<string>
): PRReviewWorkspaceState {
  const fallback = defaultWorkspaceState();

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const input = value as PRReviewWorkspaceStateInput;

  return {
    viewedFilenames: normalizeViewedFilenames(input.viewedFilenames, allowedFilenames),
    showUnviewedOnly:
      typeof input.showUnviewedOnly === 'boolean'
        ? input.showUnviewedOnly
        : fallback.showUnviewedOnly,
    fileViewMode: input.fileViewMode === 'list' ? 'list' : fallback.fileViewMode,
    sidebarCollapsed:
      typeof input.sidebarCollapsed === 'boolean'
        ? input.sidebarCollapsed
        : fallback.sidebarCollapsed,
    reviewPanelCollapsed:
      typeof input.reviewPanelCollapsed === 'boolean'
        ? input.reviewPanelCollapsed
        : fallback.reviewPanelCollapsed,
    updatedAt: normalizeUpdatedAt(input.updatedAt),
  };
}

/** Reads and normalizes PR review workspace state from a storage backend. */
export function readPRReviewWorkspaceState(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  allowedFilenames?: Set<string>
) {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return normalizePRReviewWorkspaceState(JSON.parse(raw), allowedFilenames);
  } catch {
    return null;
  }
}

/** Normalizes and persists PR review workspace state to a storage backend. */
export function writePRReviewWorkspaceState(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  state: PRReviewWorkspaceStateInput,
  allowedFilenames?: Set<string>,
  updatedAt = Date.now()
) {
  const normalizedState = normalizePRReviewWorkspaceState(
    {
      ...state,
      updatedAt,
    },
    allowedFilenames
  );

  storage.setItem(key, JSON.stringify(normalizedState));
  return normalizedState;
}
