///  Utils / Repo Contents Utils - Fetches and normalizes GitHub repository contents (files and directories) for the code explorer.
import type { H3Event } from 'h3';

import { executeGitHubRequest, extractRepoParams } from './repo-route-utils';

type RepoContentType = 'file' | 'dir' | 'symlink' | 'submodule';

interface RepoContentLinks {
  self: string;
  git: string;
  html: string;
}

interface RepoContentItem {
  name: string;
  path: string;
  type: RepoContentType;
  size: number;
  sha: string;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  _links: RepoContentLinks;
}

interface RepoFileContent extends RepoContentItem {
  type: 'file';
  content: string;
  encoding: 'base64' | 'none';
  /**
   * GitHub returns `encoding: "none"` with empty content for files between
   * 1 MB and 100 MB. Those files are downloadable through the raw endpoint
   * (via the Git Blobs API) but cannot be previewed without a large payload.
   */
  tooLarge: boolean;
}

type GitHubContentItem = RepoContentItem & {
  content?: string;
  encoding?: string;
};

/** Extract a single string from a query param that may arrive as an array. */
function getStringQueryParam(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' && rawValue ? rawValue : undefined;
}

/** Strip transient fields (content, encoding) from a content item for directory listings. */
function mapContentItem(item: GitHubContentItem): RepoContentItem {
  return {
    name: item.name,
    path: item.path,
    type: item.type,
    size: item.size,
    sha: item.sha,
    url: item.url,
    html_url: item.html_url,
    git_url: item.git_url,
    download_url: item.download_url,
    _links: item._links,
  };
}

/**
 * Map a raw content response to typed file metadata, or null if the item is not
 * a file. Files without inline base64 content (GitHub returns `encoding: "none"`
 * for 1–100 MB files) keep their metadata with empty content and a `tooLarge`
 * flag so the preview can show a clear message instead of an empty file.
 */
export function mapFileContent(item: GitHubContentItem): RepoFileContent | null {
  if (item.type !== 'file') {
    return null;
  }

  const hasBase64Content = item.encoding === 'base64';

  return {
    ...mapContentItem(item),
    type: 'file',
    content: hasBase64Content ? item.content || '' : '',
    encoding: hasBase64Content ? 'base64' : 'none',
    tooLarge: !hasBase64Content,
  };
}

/**
 * Extract the content path from route params, supporting both
 * single-segment and multi-segment (catch-all) path parameters.
 */
export function getContentPath(event: H3Event) {
  const params = event.context.params as { path?: string | string[] } | undefined;
  const path = params?.path;

  if (Array.isArray(path)) {
    return path.join('/');
  }

  return path || '';
}

/**
 * Fetch repository contents at the given path via the GitHub API.
 * Returns an array of content items for directories, or a single
 * file content object for files.
 */
export function fetchRepoContents(event: H3Event, contentPath = getContentPath(event)) {
  const { owner, repo } = extractRepoParams(event);
  const query = getQuery(event);
  const ref = getStringQueryParam(query.ref);

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: contentPath,
        ref,
      });

      if (Array.isArray(data)) {
        return data.map((item) => mapContentItem(item as GitHubContentItem));
      }

      return mapFileContent(data as GitHubContentItem);
    },
    'Failed to fetch repository contents'
  );
}
