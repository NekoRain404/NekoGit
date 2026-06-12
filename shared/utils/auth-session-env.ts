/** Resolves the session cookie Secure flag from environment variables. */
export const DEFAULT_AUTH_SESSION_COOKIE_SECURE = true;

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

export function normalizeBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;

  return defaultValue;
}

export function resolveAuthSessionCookieSecure(env: Record<string, string | undefined>): boolean {
  return normalizeBooleanEnv(
    env.NUXT_NEKOGIT_AUTH_SESSION_COOKIE_SECURE,
    DEFAULT_AUTH_SESSION_COOKIE_SECURE
  );
}
