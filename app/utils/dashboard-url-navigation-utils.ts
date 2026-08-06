/// Mapping of GitHub URLs to dashboard navigation targets and query keys.
import type { LocationQueryRaw } from 'vue-router';

import { isGitHubApiHost, isGitHubWebHost, parseUrl } from './github-url-utils';
import {
  buildRepoFileDashboardQuery,
  parseMarkdownRepoResource,
  type MarkdownRepoContext,
  type MarkdownRepoResource,
} from './markdown-repo-path-utils';
import parseGitHubMarkdownTarget from './parseGitHubMarkdownTarget';
import parseGitHubRepoPath from './parseGitHubRepoPath';

/** Allowed sub-views for a pull-request dashboard detail. */
export type PullRequestDashboardView = 'diff';

const PULL_REQUEST_DIFF_VIEW_SEGMENTS = new Set(['changes', 'files']);

/** All query-parameter keys used by dashboard detail views. */
export const DASHBOARD_DETAIL_QUERY_KEYS = [
  'issue',
  'pr',
  'prView',
  'discussion',
  'repo',
  'path',
  'branch',
  'url',
] as const;

/** Union type of all dashboard detail query-parameter keys. */
export type DashboardDetailQueryKey = (typeof DASHBOARD_DETAIL_QUERY_KEYS)[number];

/**
 * A typed navigation target for the dashboard (issue, PR, discussion,
 * repo, or file).
 */
export interface DashboardNavigationEntry {
  type:
    | 'dashboard'
    | 'issue'
    | 'pull-request'
    | 'discussion'
    | 'repository'
    | 'notification'
    | 'file';
  data?: {
    owner?: string;
    repo?: string;
    number?: number;
    tab?: string;
    path?: string;
    branch?: string;
    view?: PullRequestDashboardView;
  };
}

interface DashboardNavigationQueryOptions {
  defaultTab?: string;
  repositoryTab?: string;
  normalizeBranch?: (
    entry: DashboardNavigationEntry,
    branch: string | undefined
  ) => string | undefined;
}

/** Returns a copy of the query object with all detail keys removed. */
export function clearDashboardDetailQuery(query: LocationQueryRaw): LocationQueryRaw {
  return {
    ...query,
    issue: undefined,
    pr: undefined,
    prView: undefined,
    discussion: undefined,
    repo: undefined,
    path: undefined,
    branch: undefined,
    url: undefined,
  };
}

function serializeDashboardDetailTarget(owner: string, repo: string, number: number) {
  return `${owner}/${repo}/${number}`;
}

function serializeDashboardRepoTarget(owner: string, repo: string) {
  return `${owner}/${repo}`;
}

function getNavigationBranch(
  entry: DashboardNavigationEntry,
  options: DashboardNavigationQueryOptions
) {
  return options.normalizeBranch?.(entry, entry.data?.branch) ?? entry.data?.branch;
}

/** Converts a navigation entry into vue-router query parameters for the dashboard. */
export function buildDashboardQueryFromNavigationEntry(
  entry: DashboardNavigationEntry | null | undefined,
  options: DashboardNavigationQueryOptions = {}
): LocationQueryRaw | null {
  if (!entry || entry.type === 'dashboard' || entry.type === 'notification') {
    return null;
  }

  const data = entry.data;

  if (entry.type === 'issue' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab ?? options.defaultTab,
      issue: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'pull-request' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab ?? options.defaultTab,
      pr: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
      prView: data.view,
    };
  }

  if (entry.type === 'discussion' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab ?? options.defaultTab,
      discussion: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'repository' && data?.owner && data.repo) {
    return {
      tab: data.tab ?? options.repositoryTab ?? options.defaultTab,
      repo: serializeDashboardRepoTarget(data.owner, data.repo),
      branch: getNavigationBranch(entry, options),
    };
  }

  if (entry.type === 'file' && data?.owner && data.repo) {
    return {
      tab: data.tab,
      repo: serializeDashboardRepoTarget(data.owner, data.repo),
      path: data.path ?? '',
      branch: getNavigationBranch(entry, options),
    };
  }

  return null;
}

/** Discriminated union of dashboard URL targets resolved from GitHub URLs. */
export type DashboardUrlTarget =
  | {
      type: 'issue';
      owner: string;
      repo: string;
      number: number;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'pull-request';
      owner: string;
      repo: string;
      number: number;
      view?: PullRequestDashboardView;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'discussion';
      owner: string;
      repo: string;
      number: number;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'repository';
      owner: string;
      repo: string;
      branch?: string;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'file';
      owner: string;
      repo: string;
      path: string;
      branch?: string;
      query: LocationQueryRaw;
      hash?: string;
    };

interface PullRequestUrlTarget {
  owner: string;
  repo: string;
  number: number;
  view?: PullRequestDashboardView;
  hash?: string;
}

interface GitHubRepositoryBranchTarget {
  owner: string;
  repo: string;
  branch?: string;
  hash?: string;
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getPathSegments(url: URL) {
  return url.pathname.split('/').filter(Boolean).map(decodePathSegment);
}

function parsePositiveNumber(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const number = Number.parseInt(value, 10);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function createPullRequestTarget(target: PullRequestUrlTarget): DashboardUrlTarget {
  const query: LocationQueryRaw = {
    pr: `${target.owner}/${target.repo}/${target.number}`,
    prView: target.view,
  };

  return {
    type: 'pull-request',
    owner: target.owner,
    repo: target.repo,
    number: target.number,
    view: target.view,
    query,
    hash: target.hash,
  };
}

function parseGitHubPullRequestUrl(value: string): PullRequestUrlTarget | null {
  const url = parseUrl(value);
  if (!url) return null;

  if (isGitHubWebHost(url.hostname)) {
    const [owner, repo, kind, numberSegment, viewSegment] = getPathSegments(url);
    const number = parsePositiveNumber(numberSegment);

    if (!owner || !repo || kind !== 'pull' || !number) {
      return null;
    }

    return {
      owner,
      repo,
      number,
      view:
        PULL_REQUEST_DIFF_VIEW_SEGMENTS.has(viewSegment ?? '') || url.hash.startsWith('#diff-') // detect /files or /changes sub-path as diff view
          ? 'diff'
          : undefined,
      hash: url.hash || undefined,
    };
  }

  if (isGitHubApiHost(url.hostname)) {
    const [reposSegment, owner, repo, kind, numberSegment] = getPathSegments(url);
    const number = parsePositiveNumber(numberSegment);

    if (reposSegment !== 'repos' || !owner || !repo || kind !== 'pulls' || !number) {
      return null;
    }

    return {
      owner,
      repo,
      number,
      hash: url.hash || undefined,
    };
  }

  return null;
}

function parseGitHubRepositoryBranchUrl(value: string): GitHubRepositoryBranchTarget | null {
  const url = parseUrl(value);
  if (!url || !isGitHubWebHost(url.hostname)) return null;

  const [owner, repo, kind, ...branchSegments] = getPathSegments(url);
  if (!owner || !repo || kind !== 'tree' || branchSegments.length !== 1) {
    return null;
  }

  return {
    owner,
    repo,
    branch: branchSegments[0],
    hash: url.hash || undefined,
  };
}

function createIssueTarget(
  owner: string,
  repo: string,
  number: number,
  hash?: string
): DashboardUrlTarget {
  return {
    type: 'issue',
    owner,
    repo,
    number,
    query: {
      issue: `${owner}/${repo}/${number}`,
    },
    hash,
  };
}

function createDiscussionTarget(
  owner: string,
  repo: string,
  number: number,
  hash?: string
): DashboardUrlTarget {
  return {
    type: 'discussion',
    owner,
    repo,
    number,
    query: {
      discussion: `${owner}/${repo}/${number}`,
    },
    hash,
  };
}

function createRepoTarget(
  owner: string,
  repo: string,
  branch?: string,
  hash?: string
): DashboardUrlTarget {
  return {
    type: 'repository',
    owner,
    repo,
    branch,
    query: {
      repo: `${owner}/${repo}`,
      branch,
    },
    hash,
  };
}

function createFileTarget(resource: MarkdownRepoResource): DashboardUrlTarget {
  return {
    type: 'file',
    owner: resource.owner,
    repo: resource.repo,
    path: resource.path,
    branch: resource.branch,
    query: buildRepoFileDashboardQuery(resource),
    hash: resource.hash,
  };
}

/** Parses a GitHub URL or shorthand into a structured dashboard navigation target. */
export function parseDashboardUrlTarget(
  value: string | null | undefined,
  context: MarkdownRepoContext = {}
): DashboardUrlTarget | null {
  const rawValue = value?.trim();
  if (!rawValue) return null;

  const pullRequestUrl = parseGitHubPullRequestUrl(rawValue);
  if (pullRequestUrl) {
    return createPullRequestTarget(pullRequestUrl);
  }

  const detailTarget = parseGitHubMarkdownTarget(rawValue);
  if (detailTarget) {
    if (detailTarget.type === 'issue') {
      return createIssueTarget(detailTarget.owner, detailTarget.repo, detailTarget.number);
    }

    if (detailTarget.type === 'discussion') {
      return createDiscussionTarget(detailTarget.owner, detailTarget.repo, detailTarget.number);
    }

    return createPullRequestTarget({
      owner: detailTarget.owner,
      repo: detailTarget.repo,
      number: detailTarget.number,
    });
  }

  const resource = parseMarkdownRepoResource(rawValue, context);
  if (resource) {
    return createFileTarget(resource);
  }

  const branchTarget = parseGitHubRepositoryBranchUrl(rawValue);
  if (branchTarget) {
    return createRepoTarget(
      branchTarget.owner,
      branchTarget.repo,
      branchTarget.branch,
      branchTarget.hash
    );
  }

  const repoTarget = parseUrl(rawValue) ? parseGitHubRepoPath(rawValue) : null;
  if (repoTarget) {
    const branch =
      context.branch &&
      context.owner?.toLowerCase() === repoTarget.owner.toLowerCase() &&
      context.repo?.toLowerCase() === repoTarget.repo.toLowerCase()
        ? context.branch
        : undefined;

    return createRepoTarget(repoTarget.owner, repoTarget.repo, branch);
  }

  return null;
}
