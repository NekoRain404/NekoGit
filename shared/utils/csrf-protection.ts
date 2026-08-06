/// Pure CSRF protection helpers: timing-safe token comparison and origin checks.
/** Constant-time string comparison to prevent timing attacks on CSRF tokens. */
export function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Parse the host portion from an Origin or Referer header value. */
export function extractOriginHost(originOrReferer: string): string | null {
  try {
    const url = new URL(originOrReferer);
    return url.host;
  } catch {
    return null;
  }
}

/** Pure CSRF decision helper (double-submit + required same-origin Origin/Referer). */
export function evaluateCsrfProtection(input: {
  headerToken: string;
  cookieToken: string;
  originOrReferer: string;
  requestHost: string;
}): { ok: true } | { ok: false; reason: 'token' | 'missing_origin' | 'origin_mismatch' } {
  if (
    !input.headerToken ||
    !input.cookieToken ||
    !timingSafeStringEqual(input.headerToken, input.cookieToken)
  ) {
    return { ok: false, reason: 'token' };
  }

  // Browser-facing default: require Origin or Referer so CSRF checks fail closed
  // when neither is present (non-browser clients must send one of them).
  if (!input.originOrReferer) {
    return { ok: false, reason: 'missing_origin' };
  }

  const originHost = extractOriginHost(input.originOrReferer);
  if (!originHost || !input.requestHost || originHost !== input.requestHost) {
    return { ok: false, reason: 'origin_mismatch' };
  }

  return { ok: true };
}
