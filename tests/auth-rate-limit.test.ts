import { describe, expect, test } from 'vitest';

import {
  checkAuthRateLimit,
  clearAuthRateLimit,
  DEFAULT_AUTH_RATE_LIMIT_OPTIONS,
  recordAuthRateLimitFailure,
  type AuthRateLimitStore,
} from '../shared/utils/auth-rate-limit';

describe('auth rate limit helper', () => {
  test('allows attempts until the max failure threshold, then locks out', () => {
    const store: AuthRateLimitStore = new Map();
    const key = 'unlock:127.0.0.1';
    const options = { ...DEFAULT_AUTH_RATE_LIMIT_OPTIONS, maxFailures: 3, lockoutMs: 60_000 };
    let now = 1_000;

    expect(checkAuthRateLimit(store, key, now, options).allowed).toBe(true);

    for (let i = 0; i < 2; i += 1) {
      const decision = recordAuthRateLimitFailure(store, key, now, options);
      expect(decision.allowed).toBe(true);
      now += 10;
    }

    const locked = recordAuthRateLimitFailure(store, key, now, options);
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterMs).toBe(60_000);

    const blocked = checkAuthRateLimit(store, key, now + 1_000, options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  test('clears failures after successful auth', () => {
    const store: AuthRateLimitStore = new Map();
    const key = 'pat:10.0.0.1';
    const options = { ...DEFAULT_AUTH_RATE_LIMIT_OPTIONS, maxFailures: 2, lockoutMs: 30_000 };

    recordAuthRateLimitFailure(store, key, 5_000, options);
    clearAuthRateLimit(store, key);

    expect(checkAuthRateLimit(store, key, 5_100, options).allowed).toBe(true);
    expect(checkAuthRateLimit(store, key, 5_100, options).remainingFailures).toBe(2);
  });

  test('resets the failure window after windowMs elapses', () => {
    const store: AuthRateLimitStore = new Map();
    const key = 'unlock:client';
    const options = {
      windowMs: 1_000,
      maxFailures: 2,
      lockoutMs: 10_000,
    };

    recordAuthRateLimitFailure(store, key, 0, options);
    const afterWindow = checkAuthRateLimit(store, key, 1_500, options);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remainingFailures).toBe(2);
  });
});
