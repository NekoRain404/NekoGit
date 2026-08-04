/** Default window for counting auth failures (15 minutes). */
export const DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Failures allowed inside the window before lockout. */
export const DEFAULT_AUTH_RATE_LIMIT_MAX_FAILURES = 8;

/** Lockout duration after the max failures threshold (15 minutes). */
export const DEFAULT_AUTH_RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000;

/** Auth rate-limit policy knobs. */
export type AuthRateLimitOptions = {
  windowMs: number;
  maxFailures: number;
  lockoutMs: number;
};

/** Per-key failure tracking state. */
export type AuthRateLimitBucket = {
  failures: number;
  windowStart: number;
  lockedUntil: number;
};

/** Result of checking whether an auth attempt is allowed. */
export type AuthRateLimitDecision = {
  allowed: boolean;
  retryAfterMs: number;
  remainingFailures: number;
};

/** Mutable store for in-process rate limiting (single Node process). */
export type AuthRateLimitStore = Map<string, AuthRateLimitBucket>;

export const DEFAULT_AUTH_RATE_LIMIT_OPTIONS: AuthRateLimitOptions = {
  windowMs: DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS,
  maxFailures: DEFAULT_AUTH_RATE_LIMIT_MAX_FAILURES,
  lockoutMs: DEFAULT_AUTH_RATE_LIMIT_LOCKOUT_MS,
};

function getBucket(store: AuthRateLimitStore, key: string): AuthRateLimitBucket {
  const existing = store.get(key);
  if (existing) {
    return existing;
  }

  const bucket: AuthRateLimitBucket = {
    failures: 0,
    windowStart: 0,
    lockedUntil: 0,
  };
  store.set(key, bucket);
  return bucket;
}

function resetBucketWindow(bucket: AuthRateLimitBucket, nowMs: number): void {
  bucket.failures = 0;
  bucket.windowStart = nowMs;
  bucket.lockedUntil = 0;
}

function isWindowExpired(
  bucket: AuthRateLimitBucket,
  nowMs: number,
  windowMs: number
): boolean {
  return bucket.failures > 0 && nowMs - bucket.windowStart > windowMs;
}

/** Check whether the client key may attempt authentication now. */
export function checkAuthRateLimit(
  store: AuthRateLimitStore,
  key: string,
  nowMs: number,
  options: AuthRateLimitOptions = DEFAULT_AUTH_RATE_LIMIT_OPTIONS
): AuthRateLimitDecision {
  const bucket = getBucket(store, key);

  if (bucket.lockedUntil > nowMs) {
    return {
      allowed: false,
      retryAfterMs: bucket.lockedUntil - nowMs,
      remainingFailures: 0,
    };
  }

  if (isWindowExpired(bucket, nowMs, options.windowMs)) {
    resetBucketWindow(bucket, nowMs);
    bucket.failures = 0;
    bucket.windowStart = 0;
  }

  const remainingFailures = Math.max(0, options.maxFailures - bucket.failures);

  return {
    allowed: true,
    retryAfterMs: 0,
    remainingFailures,
  };
}

/** Record a failed auth attempt; may enter lockout. Returns the post-update decision. */
export function recordAuthRateLimitFailure(
  store: AuthRateLimitStore,
  key: string,
  nowMs: number,
  options: AuthRateLimitOptions = DEFAULT_AUTH_RATE_LIMIT_OPTIONS
): AuthRateLimitDecision {
  const bucket = getBucket(store, key);

  if (bucket.lockedUntil > nowMs) {
    return {
      allowed: false,
      retryAfterMs: bucket.lockedUntil - nowMs,
      remainingFailures: 0,
    };
  }

  if (bucket.failures === 0 || isWindowExpired(bucket, nowMs, options.windowMs)) {
    resetBucketWindow(bucket, nowMs);
  }

  bucket.failures += 1;

  if (bucket.failures >= options.maxFailures) {
    bucket.lockedUntil = nowMs + options.lockoutMs;
    return {
      allowed: false,
      retryAfterMs: options.lockoutMs,
      remainingFailures: 0,
    };
  }

  return {
    allowed: true,
    retryAfterMs: 0,
    remainingFailures: Math.max(0, options.maxFailures - bucket.failures),
  };
}

/** Clear failures for a key after successful authentication. */
export function clearAuthRateLimit(store: AuthRateLimitStore, key: string): void {
  store.delete(key);
}
