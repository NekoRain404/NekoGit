/** Documented personal-mode secret env keys (preferred). */
export const PERSONAL_MODE_GITHUB_TOKEN_ENV = 'NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN';
export const PERSONAL_MODE_PASSWORD_ENV = 'NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD';
export const PERSONAL_MODE_COOKIE_SECRET_ENV = 'NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET';

/** Nuxt nested runtimeConfig auto-override names for `nekoGitAuth.*`. */
const NEKO_GIT_AUTH_GITHUB_TOKEN_ENV = 'NUXT_NEKO_GIT_AUTH_GITHUB_TOKEN';
const NEKO_GIT_AUTH_PASSWORD_ENV = 'NUXT_NEKO_GIT_AUTH_PERSONAL_PASSWORD';
const NEKO_GIT_AUTH_COOKIE_SECRET_ENV = 'NUXT_NEKO_GIT_AUTH_PERSONAL_COOKIE_SECRET';

/** Minimum personal-mode lock password length (UTF-8 bytes). */
export const MIN_PERSONAL_PASSWORD_BYTES = 12;

/** Resolved personal-mode secrets used by runtimeConfig and server auth. */
export type PersonalModeSecrets = {
  githubToken: string;
  personalPassword: string;
  personalCookieSecret: string;
};

/** Trim a string env value; empty/whitespace becomes empty string. */
export function normalizeSecretEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Prefer documented `NUXT_GIT_PULSE_AUTH_*` names, then Nuxt nested
 * `NUXT_NEKO_GIT_AUTH_*` overrides for the same secrets.
 */
function firstNonEmptySecret(env: Record<string, string | undefined>, keys: string[]): string {
  for (const key of keys) {
    const value = normalizeSecretEnv(env[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

/** Resolve personal-mode GitHub token, lock password, and cookie secret from env. */
export function resolvePersonalModeSecrets(
  env: Record<string, string | undefined>
): PersonalModeSecrets {
  return {
    githubToken: firstNonEmptySecret(env, [
      PERSONAL_MODE_GITHUB_TOKEN_ENV,
      NEKO_GIT_AUTH_GITHUB_TOKEN_ENV,
    ]),
    personalPassword: firstNonEmptySecret(env, [
      PERSONAL_MODE_PASSWORD_ENV,
      NEKO_GIT_AUTH_PASSWORD_ENV,
    ]),
    personalCookieSecret: firstNonEmptySecret(env, [
      PERSONAL_MODE_COOKIE_SECRET_ENV,
      NEKO_GIT_AUTH_COOKIE_SECRET_ENV,
    ]),
  };
}

/**
 * Return true when the personal lock password meets the minimum length policy.
 * Empty passwords fail (including when personal mode is misconfigured).
 */
export function isPersonalPasswordStrongEnough(password: string): boolean {
  if (!password) {
    return false;
  }
  return Buffer.byteLength(password, 'utf8') >= MIN_PERSONAL_PASSWORD_BYTES;
}

/**
 * Assert personal password strength. Throws in production; warns in development.
 * No-op when password is empty (missing-secret checks run elsewhere).
 */
export function assertPersonalPasswordStrength(
  password: string,
  options: { nodeEnv?: string | undefined } = {}
): void {
  if (!password) {
    return;
  }

  if (isPersonalPasswordStrongEnough(password)) {
    return;
  }

  const message = `[auth] ${PERSONAL_MODE_PASSWORD_ENV} must be at least ${MIN_PERSONAL_PASSWORD_BYTES} bytes (got ${Buffer.byteLength(password, 'utf8')}).`;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  if (nodeEnv === 'production') {
    throw new Error(message);
  }

  console.warn(message);
}
