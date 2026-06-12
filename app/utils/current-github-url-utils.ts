/** Represents the current route state for GitHub URL resolution. */
export interface CurrentGitHubRoute {
  path?: string;
  query?: Record<string, unknown>;
}

/** Parameters for building a URL to a file or directory in a GitHub repository. */
export interface GitHubRepoContentUrlOptions {
  owner: string;
  repo: string;
  branch?: string;
  defaultBranch?: string;
  path?: string;
  type: 'directory' | 'file';
}

/** Normalized metadata for a resolved GitHub repository. */
export interface CurrentGitHubRepository {
  owner: string;
  repo: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
}

/** The canonical GitHub web origin. */
export const githubOrigin = 'https://github.com';
const supportedGitHubHosts = new Set([
  'github.com',
  'www.github.com',
  'api.github.com',
  'raw.githubusercontent.com',
]);
const githubWebReservedOwnerSegments = new Set([
  'apps',
  'codespaces',
  'collections',
  'dashboard',
  'enterprise',
  'explore',
  'features',
  'gist',
  'issues',
  'join',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'organizations',
  'pricing',
  'pulls',
  'search',
  'settings',
  'sponsors',
  'topics',
  'trending',
]);

const getQueryString = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }

  return typeof value === 'string' ? value : undefined;
};

const normalizeSegment = (value: string | undefined) => {
  const normalized = value
    ?.replace(/[\u0000-\u001f\u007f]+/g, '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return normalized || undefined;
};

const normalizeRepoIdentitySegment = (value: string | undefined, options?: { repo?: boolean }) => {
  if (!value) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  const normalized = decoded
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git$/i, ''); // strip trailing .git for normalization

  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    (options?.repo && normalized.length > 100) || // GitHub repo names cap at 100 chars
    (!options?.repo && normalized.length > 39) // GitHub usernames cap at 39 chars
  ) {
    return null;
  }

  return normalized;
};

const encodePath = (value: string) => {
  return value.split('/').filter(Boolean).map(encodeURIComponent).join('/');
};

const parseNumberTarget = (value: unknown) => {
  const rawValue = getQueryString(value);
  if (!rawValue) return null;

  const [owner, repo, numberSegment] = rawValue.split('/').filter(Boolean);
  const number = Number.parseInt(numberSegment ?? '', 10);

  if (!owner || !repo || !Number.isSafeInteger(number) || number < 1) {
    return null;
  }

  return {
    //
    owner,
    repo,
    number,
  };
};

const parseRepoTarget = (value: unknown) => {
  const rawValue = getQueryString(value);
  if (!rawValue) return null;

  const [owner, repo] = rawValue.split('/').filter(Boolean);
  if (!owner || !repo) return null;

  return { owner, repo }; //
};

const isSupportedGitHubUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && supportedGitHubHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

/** Normalizes a URL to a supported GitHub HTTPS origin, or null if invalid. */
export const normalizeCurrentGitHubUrl = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized && isSupportedGitHubUrl(normalized) ? normalized : null;
};

/** Resolves a GitHub URL, falling back to the GitHub origin when input is empty. */
export const resolveCurrentGitHubActionUrl = (value: string | null | undefined) => {
  return normalizeCurrentGitHubUrl(value) ?? githubOrigin;
};

/** Constructs a normalized repository object from owner and repo identifiers. */
export const buildCurrentGitHubRepository = (
  owner: string | undefined,
  repo: string | undefined
): CurrentGitHubRepository | null => {
  const normalizedOwner = normalizeRepoIdentitySegment(owner);
  const normalizedRepo = normalizeRepoIdentitySegment(repo, { repo: true });
  if (!normalizedOwner || !normalizedRepo) return null;

  const encodedOwner = encodeURIComponent(normalizedOwner);
  const encodedRepo = encodeURIComponent(normalizedRepo);
  const htmlUrl = `${githubOrigin}/${encodedOwner}/${encodedRepo}`;

  return {
    //
    owner: normalizedOwner,
    repo: normalizedRepo,
    fullName: `${normalizedOwner}/${normalizedRepo}`,
    htmlUrl,
    cloneUrl: `${htmlUrl}.git`,
  };
};

/** Extracts a repository from any supported GitHub URL (web, API, or raw content). */
export const resolveCurrentGitHubRepository = (
  value: string | null | undefined
): CurrentGitHubRepository | null => {
  const normalized = normalizeCurrentGitHubUrl(value);
  if (!normalized) return null;

  const url = new URL(normalized);
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'github.com' || host === 'www.github.com') {
    const owner = normalizeRepoIdentitySegment(segments[0]);
    if (!owner || githubWebReservedOwnerSegments.has(owner.toLowerCase())) {
      return null;
    }

    return buildCurrentGitHubRepository(owner, segments[1]);
  }

  if (host === 'api.github.com' && segments[0] === 'repos') {
    return buildCurrentGitHubRepository(segments[1], segments[2]);
  }

  if (host === 'raw.githubusercontent.com') {
    return buildCurrentGitHubRepository(segments[0], segments[1]);
  }

  return null;
};

/** Serializes a route into a stable JSON key for deduplication or caching. */
export const buildCurrentGitHubRouteKey = (route: CurrentGitHubRoute) => {
  const query = route.query ?? {};

  return JSON.stringify({
    path: route.path ?? '',
    issue: getQueryString(query.issue),
    pr: getQueryString(query.pr),
    prView: getQueryString(query.prView),
    discussion: getQueryString(query.discussion),
    repo: getQueryString(query.repo),
    branch: getQueryString(query.branch),
    filePath: getQueryString(query.path),
    url: getQueryString(query.url),
  });
};

/** Builds a canonical GitHub web URL for a file or directory within a repository. */
export const buildGitHubRepoContentUrl = ({
  owner,
  repo,
  branch,
  defaultBranch,
  path,
  type,
}: GitHubRepoContentUrlOptions) => {
  const normalizedOwner = normalizeSegment(owner);
  const normalizedRepo = normalizeSegment(repo);
  if (!normalizedOwner || !normalizedRepo) return null;

  const repoUrl = `${githubOrigin}/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(
    normalizedRepo
  )}`;
  const normalizedPath = normalizeSegment(path);
  const normalizedBranch = normalizeSegment(branch);
  const normalizedDefaultBranch = normalizeSegment(defaultBranch);

  if (!normalizedPath && (!normalizedBranch || normalizedBranch === normalizedDefaultBranch)) {
    return repoUrl;
  }

  if (!normalizedBranch) {
    return repoUrl;
  }

  const kind = type === 'file' ? 'blob' : 'tree';
  const branchPath = encodePath(normalizedBranch);
  const contentPath = normalizedPath ? `/${encodePath(normalizedPath)}` : '';
  return `${repoUrl}/${kind}/${branchPath}${contentPath}`;
};

/** Converts a dashboard route into the corresponding GitHub web URL. */
export const buildGitHubUrlFromDashboardRoute = (route: CurrentGitHubRoute) => {
  const path = route.path ?? '';
  const query = route.query ?? {};

  if (!path.replace(/\/$/, '').endsWith('/dashboard')) {
    return null;
  }

  const launchUrl = normalizeCurrentGitHubUrl(getQueryString(query.url));
  if (launchUrl) return launchUrl;

  const issueTarget = parseNumberTarget(query.issue);
  if (issueTarget) {
    return `${githubOrigin}/${encodeURIComponent(issueTarget.owner)}/${encodeURIComponent(
      issueTarget.repo
    )}/issues/${issueTarget.number}`;
  }

  const pullTarget = parseNumberTarget(query.pr);
  if (pullTarget) {
    const viewPath = getQueryString(query.prView) === 'diff' ? '/files' : '';
    return `${githubOrigin}/${encodeURIComponent(pullTarget.owner)}/${encodeURIComponent(
      pullTarget.repo
    )}/pull/${pullTarget.number}${viewPath}`;
  }

  const discussionTarget = parseNumberTarget(query.discussion);
  if (discussionTarget) {
    return `${githubOrigin}/${encodeURIComponent(discussionTarget.owner)}/${encodeURIComponent(
      discussionTarget.repo
    )}/discussions/${discussionTarget.number}`;
  }

  const repoTarget = parseRepoTarget(query.repo);
  if (!repoTarget) return null;

  return buildGitHubRepoContentUrl({
    ...repoTarget,
    branch: getQueryString(query.branch),
    path: getQueryString(query.path),
    type: 'directory',
  });
};
