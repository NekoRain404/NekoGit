///  Utils / Github Auth Utils - Creates authenticated Octokit clients and extracts GitHub tokens from user sessions.
import { Octokit } from '@octokit/core';
import type { H3Event } from 'h3';

import { resolveEnvProxyUrl } from '../../shared/utils/proxy-url';

import { createProxiedFetch, resolveGitHubProxyUrl } from './github-proxy-utils';

const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_ACCEPT_HEADER = 'application/vnd.github+json';

export type CreateGitHubClientOptions = {
  /** Optional explicit proxy URL; when omitted, process env proxy is used if set. */
  proxyUrl?: string;
};

/**
 * Create an authenticated Octokit client with NekoGit-specific headers
 * (API version, accept type, user agent). Optionally routes through a proxy.
 */
export function createGitHubClient(
  accessToken: string,
  options: CreateGitHubClientOptions = {}
): Octokit {
  const proxyUrl = options.proxyUrl !== undefined ? options.proxyUrl : resolveEnvProxyUrl();
  const proxiedFetch = createProxiedFetch(proxyUrl);

  const octokit = new Octokit({
    auth: accessToken,
    userAgent: 'nekogit',
    ...(proxiedFetch ? { request: { fetch: proxiedFetch } } : {}),
  });

  octokit.hook.before('request', (requestOptions) => {
    requestOptions.headers = {
      ...requestOptions.headers,
      accept: GITHUB_ACCEPT_HEADER,
      'x-github-api-version': GITHUB_API_VERSION,
    };
  });

  return octokit;
}

/**
 * Retrieve the GitHub access token from the current user session.
 * Throws a 401 if the token is missing.
 */
export async function getAccessToken(event: H3Event): Promise<string> {
  const session = await getUserSession(event);
  const accessToken = session.secure?.access_token;

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Access token not found in session',
    });
  }

  return accessToken;
}

/**
 * Create and return an authenticated Octokit client from the current session,
 * applying the user's proxy settings when configured.
 */
export async function getGitHubClient(event: H3Event): Promise<Octokit> {
  const accessToken = await getAccessToken(event);
  const proxyUrl = await resolveGitHubProxyUrl(event);

  return createGitHubClient(accessToken, { proxyUrl });
}

/**
 * Retrieve both the Octokit client and the authenticated user's login
 * from the current session. Throws 401 if either is missing.
 */
export async function getGitHubSessionContext(event: H3Event): Promise<{
  octokit: Octokit;
  userLogin: string;
}> {
  const session = await getUserSession(event);
  const accessToken = session.secure?.access_token;
  const userLogin = session.user?.login?.trim();

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Access token not found in session',
    });
  }

  if (!userLogin) {
    throw createError({
      statusCode: 401,
      statusMessage: 'GitHub user login not found in session',
    });
  }

  const proxyUrl = await resolveGitHubProxyUrl(event);

  return {
    octokit: createGitHubClient(accessToken, { proxyUrl }),
    userLogin,
  };
}

/** Check whether a caught error has a specific GitHub HTTP status code. */
export function hasGitHubErrorStatus(error: unknown, statusCode: number): boolean {
  return getGitHubErrorStatusCode(error) === statusCode;
}

/** Extract the HTTP status code from a GitHub API error, if present. */
export function getGitHubErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }

  return typeof error.status === 'number' ? error.status : undefined;
}

/** Extract the error message string from a GitHub API error, falling back to a default. */
export function getGitHubErrorMessage(error: unknown, fallbackStatusMessage: string): string {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return fallbackStatusMessage;
  }

  return typeof error.message === 'string' && error.message ? error.message : fallbackStatusMessage;
}

/**
 * Re-throw a caught error as an H3 `createError` with the original status code
 * and message, or fall back to a 500 with the provided default message.
 */
export function throwGitHubRouteError(error: unknown, fallbackStatusMessage: string): never {
  if (error && typeof error === 'object') {
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : 'status' in error && typeof error.status === 'number'
          ? error.status
          : null;

    if (statusCode) {
      const statusMessage =
        'statusMessage' in error && typeof error.statusMessage === 'string'
          ? error.statusMessage
          : 'message' in error && typeof error.message === 'string'
            ? error.message
            : fallbackStatusMessage;

      throw createError({
        statusCode,
        statusMessage,
      });
    }
  }

  throw createError({
    statusCode: 500,
    statusMessage: fallbackStatusMessage,
  });
}
