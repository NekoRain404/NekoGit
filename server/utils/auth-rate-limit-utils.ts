///  Utils / Auth Rate Limit Utils
import type { H3Event } from 'h3';
import { getHeader } from 'h3';

import {
  isAuthTrustProxyEnabled,
  resolveAuthRateLimitIp,
} from '../../shared/utils/auth-client-ip';
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
  const decision = checkAuthRateLimit(
    unlockRateLimitStore,
    resolveAuthClientKey(event, 'unlock'),
    Date.now(),
    DEFAULT_AUTH_RATE_LIMIT_OPTIONS
  );
  if (!decision.allowed) {
    throwRateLimited(decision.retryAfterMs);
  }
}

/** Record a failed personal-mode unlock and lock out after the threshold. */
export function recordUnlockFailure(event: H3Event): void {
  recordAuthRateLimitFailure(
    unlockRateLimitStore,
    resolveAuthClientKey(event, 'unlock'),
    Date.now(),
    DEFAULT_AUTH_RATE_LIMIT_OPTIONS
  );
}

/** Clear unlock failures after a successful password or remember-device unlock. */
export function clearUnlockFailures(event: H3Event): void {
  clearAuthRateLimit(unlockRateLimitStore, resolveAuthClientKey(event, 'unlock'));
}

/** Reject the request if this client is locked out for PAT login attempts. */
export function assertPatAttemptAllowed(event: H3Event): void {
  const decision = checkAuthRateLimit(
    patRateLimitStore,
    resolveAuthClientKey(event, 'pat'),
    Date.now(),
    DEFAULT_AUTH_RATE_LIMIT_OPTIONS
  );
  if (!decision.allowed) {
    throwRateLimited(decision.retryAfterMs);
  }
}

/** Record a failed PAT login attempt. */
export function recordPatFailure(event: H3Event): void {
  recordAuthRateLimitFailure(
    patRateLimitStore,
    resolveAuthClientKey(event, 'pat'),
    Date.now(),
    DEFAULT_AUTH_RATE_LIMIT_OPTIONS
  );
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
