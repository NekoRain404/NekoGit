/// Derives the native desktop window title from the current route.
/** Route state used to derive the native window title. */
export interface DesktopWindowTitleRoute {
  path?: string;
  query?: Record<string, unknown>;
}

const appName = 'NekoGit';
const maxTitlePartLength = 96;

const tabTitleMap: Record<string, string> = {
  notifications: 'Notifications',
  issues: 'Issues',
  pulls: 'Pull Requests',
  repos: 'Repositories',
};

const getQueryString = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }

  return typeof value === 'string' ? value : undefined;
};

const normalizeTitlePart = (value: unknown) => {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxTitlePartLength)
    .trim();
};

const getRepoTitle = (repo: string, branch?: string) => {
  const normalizedRepo = normalizeTitlePart(repo);
  if (!normalizedRepo) return '';

  const normalizedBranch = normalizeTitlePart(branch);
  return normalizedBranch ? `${normalizedRepo}@${normalizedBranch}` : normalizedRepo;
};

const getPathName = (path: string) => {
  return normalizeTitlePart(path.split('/').filter(Boolean).at(-1) ?? path);
};

const appendAppName = (title: string) => {
  const normalizedTitle = normalizeTitlePart(title);
  return normalizedTitle ? `${normalizedTitle} - ${appName}` : appName;
};

const parseNumberTarget = (value: unknown) => {
  const rawValue = getQueryString(value);
  if (!rawValue) return null;

  const [owner, repo, number] = rawValue.split('/').filter(Boolean);
  if (!owner || !repo || !number || !/^\d+$/.test(number)) return null;

  return {
    repo: `${owner}/${repo}`,
    number,
  };
};

/**
 * Derives the native window title from the current dashboard route and
 * query parameters.
 */
export const buildDesktopWindowTitle = (route: DesktopWindowTitleRoute) => {
  const path = normalizeTitlePart(route.path ?? '');
  const query = route.query ?? {};

  if (path.endsWith('/dashboard/settings')) {
    return appendAppName('Settings');
  }

  if (path.endsWith('/dashboard/tabs')) {
    return appendAppName('Tabs');
  }

  if (!path.endsWith('/dashboard')) {
    return appName;
  }

  const issueTarget = parseNumberTarget(query.issue);
  if (issueTarget) {
    return appendAppName(`#${issueTarget.number} ${issueTarget.repo}`);
  }

  const pullRequestTarget = parseNumberTarget(query.pr);
  if (pullRequestTarget) {
    const suffix = getQueryString(query.prView) === 'diff' ? 'Files' : 'Pull Request';
    return appendAppName(`#${pullRequestTarget.number} ${pullRequestTarget.repo} ${suffix}`);
  }

  const discussionTarget = parseNumberTarget(query.discussion);
  if (discussionTarget) {
    return appendAppName(`#${discussionTarget.number} ${discussionTarget.repo} Discussion`);
  }

  const repo = getQueryString(query.repo);
  if (repo) {
    const branch = getQueryString(query.branch);
    const filePath = getQueryString(query.path);
    const repoTitle = getRepoTitle(repo, branch);

    if (filePath !== undefined) {
      const fileName = getPathName(filePath);
      return appendAppName(fileName ? `${fileName} - ${repoTitle}` : repoTitle);
    }

    return appendAppName(repoTitle);
  }

  const tab = normalizeTitlePart(getQueryString(query.tab) ?? 'notifications');
  return appendAppName(tabTitleMap[tab] ?? tab);
};
