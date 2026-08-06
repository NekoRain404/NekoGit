/// Extracts owner/repo pairs from GitHub URLs or paths.
import {
  hasAbsoluteUrlProtocol,
  isGitHubApiHost,
  isGitHubWebHost,
  parseUrl,
} from './github-url-utils';

/** Normalized owner/repo pair extracted from a GitHub URL or path. */
export interface GitHubRepoPath {
  owner: string;
  repo: string;
  fullName: string;
}

const WEB_REPO_PATH_PATTERN = /^\/([^/]+)\/([^/]+)$/;
const API_REPO_PATH_PATTERN = /^\/repos\/([^/]+)\/([^/]+)$/;
const RELATIVE_WEB_REPO_PATH_PATTERN = /^\/?([^/]+)\/([^/]+)$/;
const RELATIVE_API_REPO_PATH_PATTERN = /^\/?repos\/([^/]+)\/([^/]+)$/;
const GITHUB_WEB_RESERVED_OWNER_SEGMENTS = new Set([
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

/**
 * Parses a GitHub URL or relative path into an owner/repo/fullName object,
 * returning null for reserved GitHub pages.
 */
export default function (url?: string | null): GitHubRepoPath | null {
  if (!url) return null;

  const match = getRepoPathMatch(url);
  if (!match) return null;

  const [, owner, repo] = match;

  if (!owner || !repo) {
    return null;
  }

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}

function getRepoPathMatch(value: string): RegExpMatchArray | null {
  if (!hasAbsoluteUrlProtocol(value)) {
    return (
      value.match(RELATIVE_API_REPO_PATH_PATTERN) ?? value.match(RELATIVE_WEB_REPO_PATH_PATTERN)
    );
  }

  const parsedUrl = parseUrl(value);
  if (!parsedUrl) {
    return null;
  }

  if (isGitHubApiHost(parsedUrl.hostname)) {
    return parsedUrl.pathname.match(API_REPO_PATH_PATTERN);
  }

  if (isGitHubWebHost(parsedUrl.hostname)) {
    const match = parsedUrl.pathname.match(WEB_REPO_PATH_PATTERN);
    const owner = match?.[1]?.toLowerCase();

    return owner && GITHUB_WEB_RESERVED_OWNER_SEGMENTS.has(owner) ? null : match;
  }

  return null;
}
