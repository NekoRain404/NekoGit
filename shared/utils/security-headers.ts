/// Baseline security-header policy for non-static web responses.

/**
 * Baseline headers for HTML and API responses. No CSP is set here: Nuxt's
 * hydration payload relies on inline scripts, and the desktop app configures
 * its own CSP separately.
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} as const;

/**
 * Build assets emitted by Nuxt/Nitro plus image/font endpoints. The Nuxt DevTools
 * client is rendered inside a same-origin iframe, so it must be exempt from
 * X-Frame-Options during development.
 */
export const STATIC_PATH_PREFIXES = [
  '/_nuxt/',
  '/__nuxt/',
  '/__nuxt_devtools__/',
  '/_ipx/',
  '/_image/',
  '/_fonts/',
] as const;

/** Whether a request path points at a static build or image/font endpoint. */
export function isStaticRequestPath(pathname: string): boolean {
  return STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Resolve the security headers for a request path. Returns null for static
 * assets and Nuxt build output so the middleware leaves them untouched.
 */
export function resolveSecurityHeaders(pathname: string): Record<string, string> | null {
  return isStaticRequestPath(pathname) ? null : { ...SECURITY_HEADERS };
}
