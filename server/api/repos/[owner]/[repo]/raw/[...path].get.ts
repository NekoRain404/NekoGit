/// Streams raw file content from a repository with content-type detection and base64 decoding.
import { Buffer } from 'node:buffer';

import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { getContentPath } from '#server/utils/repo-contents-utils';
import { extractRepoParams } from '#server/utils/repo-route-utils';
import { resolveRawRepoContentHeaders } from '#shared/utils/raw-content-type';

type RawRepoContentResponse = {
  type?: string;
  content?: string;
  encoding?: string;
  sha?: string;
  size?: number;
};

type RawGitBlobResponse = {
  content?: string;
  encoding?: string;
  size?: number;
};

/** GitHub's Contents API returns `encoding: "none"` for files above 1 MB, and
 * the Git Blobs API only supports blobs up to 100 MB. */
const MAX_RAW_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const MISSING_CONTENT_MESSAGE =
  'File content is unavailable for raw download (the file may exceed the 100 MB limit)';

function throwTooLargeError(): never {
  throw createError({
    statusCode: 413,
    statusMessage: 'File is too large to download (maximum 100 MB)',
  });
}

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

    if (!fileContent || fileContent.type !== 'file') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Repository file path was not found',
      });
    }

    // Reject known-oversized files before requesting any blob payload so we
    // never buffer more than the supported 100 MB limit.
    if (typeof fileContent.size === 'number' && fileContent.size > MAX_RAW_FILE_SIZE_BYTES) {
      throwTooLargeError();
    }

    let encodedContent: string;

    if (fileContent.encoding === 'base64') {
      encodedContent = fileContent.content || '';
    } else {
      // Files between 1 MB and 100 MB come back as `encoding: "none"` with an
      // empty content string. Fetch the blob by SHA instead.
      if (!fileContent.sha) {
        throw createError({
          statusCode: 413,
          statusMessage: MISSING_CONTENT_MESSAGE,
        });
      }

      const { data: blobData } = await octokit.request(
        'GET /repos/{owner}/{repo}/git/blobs/{file_sha}',
        {
          owner,
          repo,
          file_sha: fileContent.sha,
        }
      );
      const rawBlob = blobData as RawGitBlobResponse;

      if (rawBlob.encoding !== 'base64' || typeof rawBlob.content !== 'string') {
        throw createError({
          statusCode: 413,
          statusMessage: MISSING_CONTENT_MESSAGE,
        });
      }

      if (typeof rawBlob.size === 'number' && rawBlob.size > MAX_RAW_FILE_SIZE_BYTES) {
        throwTooLargeError();
      }

      encodedContent = rawBlob.content;
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

    return Buffer.from(encodedContent, 'base64');
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch repository file');
  }
});
