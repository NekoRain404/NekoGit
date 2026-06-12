/**
 * Determine whether the CSRF cookie should use the `Secure` flag
 * based on the request protocol (only for HTTPS).
 */
export function shouldUseSecureCsrfCookie(protocol: unknown): boolean {
  return protocol === 'https';
}
