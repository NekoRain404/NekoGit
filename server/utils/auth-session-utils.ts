///  Utils / Auth Session Utils - Persists authenticated GitHub user sessions after OAuth or PAT login.
import type { H3Event } from 'h3';

type GitHubAuthProvider = 'github' | 'pat';

/** Default max-age for persistent auth sessions (30 days). */
export const PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface GitHubIdentity {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

/**
 * Persist a GitHub user session after successful authentication,
 * storing the user profile, access token, and auth provider type.
 */
export async function establishGitHubSession(
  event: H3Event,
  provider: GitHubAuthProvider,
  accessToken: string,
  user: GitHubIdentity,
  options: { maxAge?: number } = {}
) {
  await setUserSession(
    event,
    {
      user: {
        login: user.login,
        name: user.name ?? user.login,
        avatar_url: user.avatar_url ?? '',
      },
      secure: {
        access_token: accessToken,
      },
      logged_in_at: new Date(),
      auth_provider: provider,
    },
    options.maxAge ? { maxAge: options.maxAge } : undefined
  );
}
