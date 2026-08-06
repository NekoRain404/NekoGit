/// Client IP resolution for auth rate limiting, with optional reverse-proxy trust.
/**
 * Resolve the client IP used for auth rate limiting.
 * By default uses the direct socket address only (ignores X-Forwarded-For) so
 * untrusted clients cannot rotate XFF to bypass lockout.
 * Set NUXT_NEKOGIT_AUTH_TRUST_PROXY=true only behind a trusted reverse proxy.
 */

export const AUTH_TRUST_PROXY_ENV = 'NUXT_NEKOGIT_AUTH_TRUST_PROXY';

/** True when operators explicitly trust reverse-proxy forwarding headers. */
export function isAuthTrustProxyEnabled(env: Record<string, string | undefined>): boolean {
  const value = env[AUTH_TRUST_PROXY_ENV];
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/**
 * Pure IP selection for rate-limit keys.
 * - trustProxy=false: always prefer socketRemoteAddress
 * - trustProxy=true: prefer forwardedFor (leftmost client hop) then socket
 */
export function resolveAuthRateLimitIp(input: {
  socketRemoteAddress: string | null | undefined;
  forwardedFor: string | null | undefined;
  trustProxy: boolean;
}): string {
  const socket = (input.socketRemoteAddress ?? '').trim();
  const forwarded = (input.forwardedFor ?? '').trim();

  if (input.trustProxy) {
    if (forwarded) {
      // Leftmost hop is the original client when the proxy appends correctly.
      const firstHop = forwarded.split(',')[0]?.trim() ?? '';
      if (firstHop) {
        return firstHop;
      }
    }
    if (socket) {
      return socket;
    }
    return 'unknown';
  }

  if (socket) {
    return socket;
  }
  return 'unknown';
}
