/// Unit tests for the baseline security-header policy applied to web responses.
import { describe, expect, test } from 'vitest';

import { resolveSecurityHeaders, SECURITY_HEADERS } from '../shared/utils/security-headers';

const expectedHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

describe('resolveSecurityHeaders', () => {
  test('returns the baseline headers for normal application paths', () => {
    expect(resolveSecurityHeaders('/')).toEqual(expectedHeaders);
    expect(resolveSecurityHeaders('/dashboard')).toEqual(expectedHeaders);
    expect(resolveSecurityHeaders('/repos/octocat/hello-world')).toEqual(expectedHeaders);
    expect(resolveSecurityHeaders('')).toEqual(expectedHeaders);
  });

  test('returns the baseline headers for API routes', () => {
    expect(resolveSecurityHeaders('/api/repos')).toEqual(expectedHeaders);
    expect(resolveSecurityHeaders('/api/notifications/unread-count')).toEqual(expectedHeaders);
  });

  test('skips Nuxt build output', () => {
    expect(resolveSecurityHeaders('/_nuxt/entry.abc123.js')).toBeNull();
    expect(resolveSecurityHeaders('/__nuxt/entry.abc123.js')).toBeNull();
  });

  test('skips image and font endpoints', () => {
    expect(resolveSecurityHeaders('/_ipx/w_640/image.png')).toBeNull();
    expect(resolveSecurityHeaders('/_image/image.png')).toBeNull();
    expect(resolveSecurityHeaders('/_fonts/inter.woff2')).toBeNull();
  });

  test('skips the Nuxt DevTools iframe client', () => {
    expect(resolveSecurityHeaders('/__nuxt_devtools__/client/index.html')).toBeNull();
  });

  test('exposes the same header values used by the middleware', () => {
    expect(SECURITY_HEADERS).toEqual(expectedHeaders);
  });
});
