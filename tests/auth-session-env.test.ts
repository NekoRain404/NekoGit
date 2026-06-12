import { describe, expect, test } from 'vitest';

import {
  DEFAULT_AUTH_SESSION_COOKIE_SECURE,
  normalizeBooleanEnv,
  resolveAuthSessionCookieSecure,
} from '../shared/utils/auth-session-env';

describe('normalizeBooleanEnv', () => {
  test('returns default when value is undefined', () => {
    expect(normalizeBooleanEnv(undefined, true)).toBe(true);
    expect(normalizeBooleanEnv(undefined, false)).toBe(false);
  });

  test('returns default for unrecognised strings', () => {
    expect(normalizeBooleanEnv('maybe', true)).toBe(true);
    expect(normalizeBooleanEnv('maybe', false)).toBe(false);
  });

  test.each(['1', 'true', 'TRUE', 'True', 'yes', 'YES', 'on', 'ON', ' true '])(
    'parses "%s" as true',
    (value) => {
      expect(normalizeBooleanEnv(value, false)).toBe(true);
    }
  );

  test.each(['0', 'false', 'FALSE', 'False', 'no', 'NO', 'off', 'OFF', ' false '])(
    'parses "%s" as false',
    (value) => {
      expect(normalizeBooleanEnv(value, true)).toBe(false);
    }
  );
});

describe('resolveAuthSessionCookieSecure', () => {
  test('defaults to true when env var is missing', () => {
    expect(resolveAuthSessionCookieSecure({})).toBe(DEFAULT_AUTH_SESSION_COOKIE_SECURE);
    expect(DEFAULT_AUTH_SESSION_COOKIE_SECURE).toBe(true);
  });

  test('returns false when env var is "false"', () => {
    expect(
      resolveAuthSessionCookieSecure({ NUXT_NEKOGIT_AUTH_SESSION_COOKIE_SECURE: 'false' })
    ).toBe(false);
  });

  test('returns true when env var is "true"', () => {
    expect(
      resolveAuthSessionCookieSecure({ NUXT_NEKOGIT_AUTH_SESSION_COOKIE_SECURE: 'true' })
    ).toBe(true);
  });

  test('ignores unrelated env keys', () => {
    expect(resolveAuthSessionCookieSecure({ SOME_OTHER_VAR: 'false' })).toBe(true);
  });
});
