/// GET Repos / Raw
import { Buffer } from 'node:buffer';

import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { getContentPath } from '#server/utils/repo-contents-utils';
import { extractRepoParams } from '#server/utils/repo-route-utils';
import { resolveRawRepoContentHeaders } from '#shared/utils/raw-content-type';

type RawRepoContentResponse = {
  type?: string;
  content?: string;
  encoding?: string;
};

function getStringQueryParam(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' && rawValue ? rawValue : undefined;
}

/** Stream raw file content from a repository with content-type detection and base64 decoding. */
export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const contentPath = getContentPath(event);

  if (!contentPath) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Repository file path is required',
    });
  }

  try {
    const query = getQuery(event);
    const ref = getStringQueryParam(query.ref);
    const octokit = await getGitHubClient(event);
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: contentPath,
      ref,
    });

    const fileContent = Array.isArray(data) ? null : (data as RawRepoContentResponse);

    if (!fileContent || fileContent.type !== 'file' || fileContent.encoding !== 'base64') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Repository file path was not found',
      });
    }

    const headers = resolveRawRepoContentHeaders(contentPath);
    setHeader(event, 'content-type', headers.contentType);
    setHeader(event, 'cache-control', 'private, max-age=300');
    setHeader(event, 'x-content-type-options', headers.xContentTypeOptions);
    if (headers.contentDisposition) {
      setHeader(event, 'content-disposition', headers.contentDisposition);
    }
    if (headers.contentSecurityPolicy) {
      setHeader(event, 'content-security-policy', headers.contentSecurityPolicy);
    }

    return Buffer.from(fileContent.content || '', 'base64');
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch repository file');
  }
});
