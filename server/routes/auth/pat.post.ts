/// POST Auth / Pat Post
import { resolveAuthProviderState } from '../../utils/auth-providers';
import {
  assertPatAttemptAllowed,
  clearPatFailures,
  recordPatFailure,
} from '../../utils/auth-rate-limit-utils';
import {
  PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
  establishGitHubSession,
} from '../../utils/auth-session-utils';
import { assertCsrfToken } from '../../utils/csrf-utils';
import { createGitHubClient } from '../../utils/github-auth-utils';

function isGitHubUnauthorizedError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'status' in error && error.status === 401;
}

function normalizeTokenBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return '';
  }

  const token = (body as { token?: unknown }).token;
  return typeof token === 'string' ? token.trim() : '';
}

/** Authenticate with a GitHub personal access token, validating it against the API. */
export default defineEventHandler(async (event) => {
  assertCsrfToken(event, '/auth/pat');
  assertPatAttemptAllowed(event);

  const providerState = resolveAuthProviderState();

  if (providerState.personalMode) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Token authentication is not available in personal mode',
    });
  }

  if (!providerState.patEnabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Token authentication is disabled',
    });
  }

  const token = normalizeTokenBody(await readBody(event));

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A GitHub token is required',
    });
  }

  try {
    const octokit = createGitHubClient(token);
    // One extra app-level retry for flaky local proxies (undici RetryAgent also retries).
    let response: Awaited<ReturnType<typeof octokit.request>>;
    try {
      response = await octokit.request('GET /user');
    } catch (firstError: unknown) {
      if (isGitHubUnauthorizedError(firstError)) {
        throw firstError;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      response = await octokit.request('GET /user');
    }

    const user = response.data as {
      login: string;
      name?: string | null;
      avatar_url?: string | null;
    };

    clearPatFailures(event);
    await establishGitHubSession(event, 'pat', token, user, {
      maxAge: PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
    });

    return {
      ok: true,
      user: {
        login: user.login,
        name: user.name ?? user.login,
        avatar_url: user.avatar_url ?? '',
      },
    };
  } catch (error: unknown) {
    const isUnauthorized = isGitHubUnauthorizedError(error);
    if (isUnauthorized) {
      recordPatFailure(event);
    }
    const detail =
      error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'error';
    console.error(
      `[auth] Token validation failed: ${isUnauthorized ? 'unauthorized' : 'error'} (${detail})`
    );

    throw createError({
      statusCode: isUnauthorized ? 401 : 500,
      statusMessage: isUnauthorized ? 'Invalid GitHub token' : 'Failed to validate GitHub token',
    });
  }
});
