/// POST Auth / Unlock Post
import {
  assertUnlockAttemptAllowed,
  clearUnlockFailures,
  recordUnlockFailure,
} from '../../utils/auth-rate-limit-utils';
import { establishGitHubSession } from '../../utils/auth-session-utils';
import { assertCsrfToken } from '../../utils/csrf-utils';
import {
  clearRememberDeviceCookie,
  createRememberDeviceCookie,
  getPersonalModeGithubToken,
  getPersonalModeIdentity,
  verifyPersonalPassword,
  verifyRememberDeviceCookie,
} from '../../utils/personal-mode-utils';

interface UnlockRequestBody {
  password?: unknown;
  remember?: unknown;
}

function normalizeUnlockBody(body: unknown): { password: string; remember: boolean } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
    });
  }

  const { password, remember, ...rest } = body as UnlockRequestBody & Record<string, unknown>;

  if (Object.keys(rest).length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
    });
  }

  if (password !== undefined && typeof password !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
    });
  }

  if (remember !== undefined && typeof remember !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
    });
  }

  return {
    password: typeof password === 'string' ? password.trim() : '',
    remember: remember === true,
  };
}

function getSessionUserResponse(user: {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}) {
  return {
    login: user.login,
    name: user.name ?? user.login,
    avatar_url: user.avatar_url ?? '',
  };
}

/** Unlock personal mode via password or a valid remember-device cookie. */
export default defineEventHandler(async (event) => {
  assertCsrfToken(event, '/auth/unlock');
  assertUnlockAttemptAllowed(event);

  const body = normalizeUnlockBody(await readBody(event));
  const githubToken = getPersonalModeGithubToken();
  const identity = getPersonalModeIdentity();

  if (!githubToken || !identity) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Personal mode unlock is unavailable',
    });
  }

  const session = await getUserSession(event);
  const hasActiveSession = Boolean(session.secure?.access_token && session.user?.login);

  if (!hasActiveSession && verifyRememberDeviceCookie(event)) {
    clearUnlockFailures(event);
    await establishGitHubSession(event, 'pat', githubToken, identity);

    return {
      ok: true,
      user: getSessionUserResponse(identity),
    };
  }

  if (!body.password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password is required',
    });
  }

  if (!verifyPersonalPassword(body.password)) {
    recordUnlockFailure(event);
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid password',
    });
  }

  clearUnlockFailures(event);
  await establishGitHubSession(event, 'pat', githubToken, identity);

  if (body.remember) {
    createRememberDeviceCookie(event);
  } else {
    clearRememberDeviceCookie(event);
  }

  return {
    ok: true,
    user: getSessionUserResponse(identity),
  };
});
