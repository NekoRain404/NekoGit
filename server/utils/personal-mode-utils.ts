///  Utils / Personal Mode Utils
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { H3Event } from 'h3';
import { deleteCookie, getCookie, setCookie } from 'h3';

import { resolveAuthSessionCookieSecure } from '../../shared/utils/auth-session-env';
import {
  assertPersonalPasswordStrength,
  resolvePersonalModeSecrets,
} from '../../shared/utils/personal-mode-env';

/** Cached identity for the single-user personal mode. */
export interface PersonalIdentity {
  login: string;
  name: string;
  avatar_url: string;
}

interface RememberCookiePayload {
  iat: number;
  exp: number;
  fp: string;
}

const PERSONAL_REMEMBER_COOKIE = 'nekogit_personal_remember';
const REMEMBER_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const REMEMBER_COOKIE_PATH = '/';
const PERSONAL_MODE_STORAGE_BASE = 'personal-mode';
const PERSONAL_MODE_IDENTITY_KEY = 'identity';

let personalIdentityCache: PersonalIdentity | null = null;

/** Trim and normalize a config secret, returning empty string for non-strings. */
function normalizeSecret(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Read personal-mode auth credentials.
 * Prefer live process env (`NUXT_GIT_PULSE_AUTH_*`) so production self-host works
 * when secrets are only set at process start; fall back to runtimeConfig.
 */
function getPersonalAuthConfig() {
  const fromEnv = resolvePersonalModeSecrets(process.env);
  const runtimeConfig = useRuntimeConfig() as {
    nekoGitAuth?: {
      personalPassword?: string;
      personalCookieSecret?: string;
      githubToken?: string;
    };
  };

  return {
    githubToken:
      fromEnv.githubToken || normalizeSecret(runtimeConfig.nekoGitAuth?.githubToken),
    personalPassword:
      fromEnv.personalPassword || normalizeSecret(runtimeConfig.nekoGitAuth?.personalPassword),
    personalCookieSecret:
      fromEnv.personalCookieSecret ||
      normalizeSecret(runtimeConfig.nekoGitAuth?.personalCookieSecret),
  };
}

/** Public accessor for the personal-mode GitHub PAT (env preferred). */
export function getPersonalModeGithubToken(): string {
  return getPersonalAuthConfig().githubToken;
}

/** Return standard cookie security options; Secure follows the session cookie policy. */
function getCookieSecurityOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: REMEMBER_COOKIE_PATH,
    maxAge: REMEMBER_COOKIE_MAX_AGE_SECONDS,
    secure: resolveAuthSessionCookieSecure(process.env),
  };
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

/** Constant-time string comparison using Node's `timingSafeEqual`. */
function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

const PERSONAL_REMEMBER_FINGERPRINT_DOMAIN = 'nekogit:personal-remember:fp:v1|';
const MIN_COOKIE_SECRET_BYTES = 32;

/** Derive an HMAC-SHA256 fingerprint for the personal-mode password. */
function fingerprintForPassword(password: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${PERSONAL_REMEMBER_FINGERPRINT_DOMAIN}${password}`)
    .digest('base64url');
}

/**
 * Assert that the personal-mode cookie secret meets the minimum byte length.
 * Throws in production, warns in development.
 */
export function assertPersonalCookieSecretStrength(): void {
  const { personalCookieSecret } = getPersonalAuthConfig();
  const byteLength = Buffer.byteLength(personalCookieSecret, 'utf8');

  if (byteLength >= MIN_COOKIE_SECRET_BYTES) {
    return;
  }

  const message = `[auth] NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET (formerly AUTH_PERSONAL_COOKIE_SECRET) must be at least ${MIN_COOKIE_SECRET_BYTES} bytes (got ${byteLength}).`;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }

  console.warn(message);
}

/**
 * Assert personal lock password minimum strength when personal mode is enabled.
 * Uses the same production hard-fail / development warn policy as the cookie secret.
 */
export function assertPersonalPasswordConfigStrength(): void {
  const { personalPassword } = getPersonalAuthConfig();
  assertPersonalPasswordStrength(personalPassword, { nodeEnv: process.env.NODE_ENV });
}

/** HMAC-sign a remember-device payload and return the encoded `payload.signature` string. */
function signRememberPayload(payload: RememberCookiePayload, secret: string): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${toBase64Url(signature)}`;
}

/** Verify and decode a signed remember-device cookie value, returning null on any failure. */
function verifySignedRememberPayload(value: string, secret: string): RememberCookiePayload | null {
  const [encodedPayload, encodedSignature] = value.split('.');

  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest();
  const actualSignature = Buffer.from(encodedSignature, 'base64url');

  if (expectedSignature.length !== actualSignature.length) {
    return null;
  }

  if (!timingSafeEqual(expectedSignature, actualSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as
      | RememberCookiePayload
      | undefined;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    if (
      typeof payload.iat !== 'number' ||
      !Number.isFinite(payload.iat) ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) ||
      typeof payload.fp !== 'string' ||
      !payload.fp
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/** Cache the personal-mode identity in memory for the current process lifetime. */
export function cachePersonalModeIdentity(identity: PersonalIdentity) {
  personalIdentityCache = {
    login: identity.login,
    name: identity.name,
    avatar_url: identity.avatar_url,
  };
}

/** Return the cached personal-mode identity, or null if not yet set. */
export function getPersonalModeIdentity(): PersonalIdentity | null {
  return personalIdentityCache;
}

/** Validate a password input against the configured personal-mode password using constant-time comparison. */
export function verifyPersonalPassword(input: string): boolean {
  const { personalPassword } = getPersonalAuthConfig();
  const normalizedInput = typeof input === 'string' ? input : '';

  if (!personalPassword || !normalizedInput) {
    return false;
  }

  return constantTimeStringEqual(personalPassword, normalizedInput);
}

/**
 * Set a signed "remember device" cookie so the user can skip
 * password re-entry on subsequent visits within the cookie lifetime.
 */
export function createRememberDeviceCookie(event: H3Event): void {
  const { personalPassword, personalCookieSecret } = getPersonalAuthConfig();

  if (!personalPassword || !personalCookieSecret) {
    return;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: RememberCookiePayload = {
    iat: issuedAt,
    exp: issuedAt + REMEMBER_COOKIE_MAX_AGE_SECONDS,
    fp: fingerprintForPassword(personalPassword, personalCookieSecret),
  };

  const signedValue = signRememberPayload(payload, personalCookieSecret);

  setCookie(event, PERSONAL_REMEMBER_COOKIE, signedValue, {
    ...getCookieSecurityOptions(),
    expires: new Date(payload.exp * 1000),
  });
}

/** Delete the remember-device cookie from the client. */
export function clearRememberDeviceCookie(event: H3Event): void {
  deleteCookie(event, PERSONAL_REMEMBER_COOKIE, {
    ...getCookieSecurityOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Verify the remember-device cookie: validates signature, expiry,
 * and password fingerprint. Clears the cookie if any check fails.
 */
export function verifyRememberDeviceCookie(event: H3Event): boolean {
  const cookieValue = getCookie(event, PERSONAL_REMEMBER_COOKIE);
  const { personalPassword, personalCookieSecret } = getPersonalAuthConfig();

  if (!cookieValue || !personalPassword || !personalCookieSecret) {
    if (cookieValue) {
      clearRememberDeviceCookie(event);
    }

    return false;
  }

  const payload = verifySignedRememberPayload(cookieValue, personalCookieSecret);

  if (!payload) {
    clearRememberDeviceCookie(event);
    return false;
  }

  // Reject expired or malformed timestamps
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || payload.iat > payload.exp) {
    clearRememberDeviceCookie(event);
    return false;
  }

  const expectedFingerprint = fingerprintForPassword(personalPassword, personalCookieSecret);

  if (!constantTimeStringEqual(payload.fp, expectedFingerprint)) {
    clearRememberDeviceCookie(event);
    return false;
  }

  return true;
}
