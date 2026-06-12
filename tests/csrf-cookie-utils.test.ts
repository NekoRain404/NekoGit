import { describe, expect, test } from 'vitest';

import { shouldUseSecureCsrfCookie } from '../server/utils/csrf-cookie-utils';

describe('CSRF cookie security', () => {
  test('does not force Secure cookies for local HTTP desktop server requests', () => {
    expect(shouldUseSecureCsrfCookie('http')).toBe(false);
  });

  test('uses Secure cookies when the incoming request is HTTPS', () => {
    expect(shouldUseSecureCsrfCookie('https')).toBe(true);
  });
});
