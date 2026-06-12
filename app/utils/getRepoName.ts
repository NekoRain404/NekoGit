import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

/**
 * Resolves a human-readable repository name from a GitHub URL, falling
 * back to the last path segment.
 */
export default function (url: string) {
  const repoPath = parseGitHubRepoPath(url);
  if (repoPath) {
    return repoPath.fullName;
  }

  const parts = url.split('/');
  return parts[parts.length - 1] || 'Unknown';
}
