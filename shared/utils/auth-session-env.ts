/// Resolves the auth session cookie Secure flag and normalizes boolean env values.
/** Resolves the session cookie Secure flag from environment variables. */
export const DEFAULT_AUTH_SESSION_COOKIE_SECURE = true;

/** ENABLED VALUES. */
const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
/** DISABLED VALUES. */
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

/** normalize Boolean Env. */
export function normalizeBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue;

  /** normalized. */
  const normalized = value.trim().toLowerCase();
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;

  return defaultValue;
}

/** resolve Auth Session Cookie Secure. */
export function resolveAuthSessionCookieSecure(env: Record<string, string | undefined>): boolean {
  return normalizeBooleanEnv(
    env.NUXT_NEKOGIT_AUTH_SESSION_COOKIE_SECURE,
    DEFAULT_AUTH_SESSION_COOKIE_SECURE
  );
}
