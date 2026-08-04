import { describe, expect, test } from 'vitest';

import {
  assertPersonalPasswordStrength,
  isPersonalPasswordStrongEnough,
  MIN_PERSONAL_PASSWORD_BYTES,
  PERSONAL_MODE_COOKIE_SECRET_ENV,
  PERSONAL_MODE_GITHUB_TOKEN_ENV,
  PERSONAL_MODE_PASSWORD_ENV,
  resolvePersonalModeSecrets,
} from '../shared/utils/personal-mode-env';

describe('resolvePersonalModeSecrets', () => {
  test('loads documented NUXT_GIT_PULSE_AUTH_* secrets', () => {
    const secrets = resolvePersonalModeSecrets({
      [PERSONAL_MODE_GITHUB_TOKEN_ENV]: ' ghp_documented_token ',
      [PERSONAL_MODE_PASSWORD_ENV]: ' strong-password-here ',
      [PERSONAL_MODE_COOKIE_SECRET_ENV]: ' cookie-secret-at-least-32-bytes-long!! ',
    });

    expect(secrets.githubToken).toBe('ghp_documented_token');
    expect(secrets.personalPassword).toBe('strong-password-here');
    expect(secrets.personalCookieSecret).toBe('cookie-secret-at-least-32-bytes-long!!');
  });

  test('falls back to NUXT_NEKO_GIT_AUTH_* when documented keys are empty', () => {
    const secrets = resolvePersonalModeSecrets({
      NUXT_NEKO_GIT_AUTH_GITHUB_TOKEN: 'ghp_nested_token',
      NUXT_NEKO_GIT_AUTH_PERSONAL_PASSWORD: 'nested-password-12',
      NUXT_NEKO_GIT_AUTH_PERSONAL_COOKIE_SECRET: 'nested-cookie-secret-32-bytes-min!!',
    });

    expect(secrets.githubToken).toBe('ghp_nested_token');
    expect(secrets.personalPassword).toBe('nested-password-12');
    expect(secrets.personalCookieSecret).toBe('nested-cookie-secret-32-bytes-min!!');
  });

  test('prefers documented keys over nested Nuxt override names', () => {
    const secrets = resolvePersonalModeSecrets({
      [PERSONAL_MODE_GITHUB_TOKEN_ENV]: 'ghp_preferred',
      NUXT_NEKO_GIT_AUTH_GITHUB_TOKEN: 'ghp_ignored',
    });

    expect(secrets.githubToken).toBe('ghp_preferred');
  });

  test('returns empty strings when secrets are missing', () => {
    expect(resolvePersonalModeSecrets({})).toEqual({
      githubToken: '',
      personalPassword: '',
      personalCookieSecret: '',
    });
  });
});

describe('personal password strength', () => {
  test('rejects empty and short passwords', () => {
    expect(isPersonalPasswordStrongEnough('')).toBe(false);
    expect(isPersonalPasswordStrongEnough('short')).toBe(false);
    expect(isPersonalPasswordStrongEnough('a'.repeat(MIN_PERSONAL_PASSWORD_BYTES - 1))).toBe(false);
  });

  test('accepts passwords meeting the minimum byte length', () => {
    expect(isPersonalPasswordStrongEnough('a'.repeat(MIN_PERSONAL_PASSWORD_BYTES))).toBe(true);
    expect(isPersonalPasswordStrongEnough('unicode-密码-123456')).toBe(true);
  });

  test('assertPersonalPasswordStrength throws in production for weak passwords', () => {
    expect(() =>
      assertPersonalPasswordStrength('weak', { nodeEnv: 'production' })
    ).toThrowError(/at least 12 bytes/);
  });

  test('assertPersonalPasswordStrength no-ops for empty password (missing handled elsewhere)', () => {
    expect(() => assertPersonalPasswordStrength('', { nodeEnv: 'production' })).not.toThrow();
  });

  test('process-env documented names alone are enough for runtime secret resolution', () => {
    // Mirrors production self-host: secrets only on process.env at start, not baked runtimeConfig.
    const envOnly = {
      NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN: 'ghp_env_only_token',
      NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD: 'env-only-password-12',
      NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET: 'env-only-cookie-secret-32-bytes-min!',
    };
    const secrets = resolvePersonalModeSecrets(envOnly);
    expect(secrets.githubToken).toBe('ghp_env_only_token');
    expect(secrets.personalPassword).toBe('env-only-password-12');
    expect(secrets.personalCookieSecret).toBe('env-only-cookie-secret-32-bytes-min!');
  });
});
