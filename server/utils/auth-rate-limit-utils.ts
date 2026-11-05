///  Utils / Auth Rate Limit Utils - Enforces per-client rate limits on personal-mode unlock and PAT login attempts.
import type { H3Event } from 'h3';
import { getHeader } from 'h3';

import { isAuthTrustProxyEnabled, resolveAuthRateLimitIp } from '../../shared/utils/auth-client-ip';
import {
  checkAuthRateLimit,
  clearAuthRateLimit,
  DEFAULT_AUTH_RATE_LIMIT_OPTIONS,
  recordAuthRateLimitFailure,
  type AuthRateLimitStore,
} from '../../shared/utils/auth-rate-limit';

/** Process-local stores for personal unlock and PAT login. */
const unlockRateLimitStore: AuthRateLimitStore = new Map();
const patRateLimitStore: AuthRateLimitStore = new Map();

/** Upper bound for each process-local store to prevent memory exhaustion. */
const AUTH_RATE_LIMIT_STORE_MAX_ENTRIES = 10_000;

/**
 * Keep a store bounded without changing rate-limit semantics for retained keys.
 * Expired buckets are pruned first; if the store is still full, the oldest
 * insertion-order entries are evicted. Evicted clients simply start a fresh
 * window on their next attempt.
 */
function ensureAuthRateLimitStoreCapacity(
  store: AuthRateLimitStore,
  key: string,
  nowMs = Date.now()
): void {
  if (store.has(key) || store.size < AUTH_RATE_LIMIT_STORE_MAX_ENTRIES) {
    return;
  }

  for (const [storeKey, bucket] of store) {
    const windowExpired =
      bucket.failures === 0 ||
      nowMs - bucket.windowStart > DEFAULT_AUTH_RATE_LIMIT_OPTIONS.windowMs;
    if (bucket.lockedUntil <= nowMs && windowExpired) {
      store.delete(storeKey);
    }
  }

  while (store.size >= AUTH_RATE_LIMIT_STORE_MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    store.delete(oldestKey);
  }
}

/** Socket remote address for the connection (not spoofable via XFF). */
function socketRemoteAddress(event: H3Event): string | null {
  const socket = event.node.req.socket;
  const address = socket?.remoteAddress;
  return typeof address === 'string' && address ? address : null;
}

/**
 * Rate-limit key source: direct socket IP by default.
 * X-Forwarded-For is only honored when NUXT_NEKOGIT_AUTH_TRUST_PROXY is enabled.
 */
export function resolveAuthClientKey(event: H3Event, scope: string): string {
  const ip = resolveAuthRateLimitIp({
    socketRemoteAddress: socketRemoteAddress(event),
    forwardedFor: getHeader(event, 'x-forwarded-for'),
    trustProxy: isAuthTrustProxyEnabled(process.env),
  });
  return `${scope}:${ip}`;
}

function throwRateLimited(retryAfterMs: number): never {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  throw createError({
    statusCode: 429,
    statusMessage: 'Too many authentication attempts. Try again later.',
    data: { retryAfterSeconds },
  });
}

/** Reject the request if this client is currently locked out for unlock attempts. */
export function assertUnlockAttemptAllowed(event: H3Event): void {
  const key = resolveAuthClientKey(event, 'unlock');
  const nowMs = Date.now();
  ensureAuthRateLimitStoreCapacity(unlockRateLimitStore, key, nowMs);
  const decision = checkAuthRateLimit(
    unlockRateLimitStore,
    key,
    nowMs,
    DEFAULT_AUTH_RATE_LIMIT_OPTIONS
  );
  if (!decision.allowed) {
    throwRateLimited(decision.retryAfterMs);
  }
}

/** Record a failed personal-mode unlock and lock out after the threshold. */
export function recordUnlockFailure(event: H3Event): void {
  const key = resolveAuthClientKey(event, 'unlock');
  const nowMs = Date.now();
  ensureAuthRateLimitStoreCapacity(unlockRateLimitStore, key, nowMs);
  recordAuthRateLimitFailure(unlockRateLimitStore, key, nowMs, DEFAULT_AUTH_RATE_LIMIT_OPTIONS);
}

/** Clear unlock failures after a successful password or remember-device unlock. */
export function clearUnlockFailures(event: H3Event): void {
  clearAuthRateLimit(unlockRateLimitStore, resolveAuthClientKey(event, 'unlock'));
}

/** Reject the request if this client is locked out for PAT login attempts. */
export function assertPatAttemptAllowed(event: H3Event): void {
  const key = resolveAuthClientKey(event, 'pat');
  const nowMs = Date.now();
  ensureAuthRateLimitStoreCapacity(patRateLimitStore, key, nowMs);
  const decision = checkAuthRateLimit(
    patRateLimitStore,
    key,
    nowMs,
    DEFAULT_AUTH_RATE_LIMIT_OPTIONS
  );
  if (!decision.allowed) {
    throwRateLimited(decision.retryAfterMs);
  }
}

/** Record a failed PAT login attempt. */
export function recordPatFailure(event: H3Event): void {
  const key = resolveAuthClientKey(event, 'pat');
  const nowMs = Date.now();
  ensureAuthRateLimitStoreCapacity(patRateLimitStore, key, nowMs);
  recordAuthRateLimitFailure(patRateLimitStore, key, nowMs, DEFAULT_AUTH_RATE_LIMIT_OPTIONS);
}

/** Clear PAT failures after a successful token login. */
export function clearPatFailures(event: H3Event): void {
  clearAuthRateLimit(patRateLimitStore, resolveAuthClientKey(event, 'pat'));
}

/** Test helper: wipe process-local stores (not used in production routes). */
export function __resetAuthRateLimitStoresForTests(): void {
  unlockRateLimitStore.clear();
  patRateLimitStore.clear();
}
