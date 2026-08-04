import { describe, expect, test } from 'vitest';

import { evaluateCsrfProtection } from '../shared/utils/csrf-protection';

describe('evaluateCsrfProtection', () => {
  const valid = {
    headerToken: 'csrf-token-value',
    cookieToken: 'csrf-token-value',
    originOrReferer: 'http://127.0.0.1:3000',
    requestHost: '127.0.0.1:3000',
  };

  test('accepts matching double-submit tokens with same-origin Origin', () => {
    expect(evaluateCsrfProtection(valid)).toEqual({ ok: true });
  });

  test('rejects when both Origin and Referer are missing', () => {
    expect(
      evaluateCsrfProtection({
        ...valid,
        originOrReferer: '',
      })
    ).toEqual({ ok: false, reason: 'missing_origin' });
  });

  test('rejects token mismatch', () => {
    expect(
      evaluateCsrfProtection({
        ...valid,
        headerToken: 'other',
      })
    ).toEqual({ ok: false, reason: 'token' });
  });

  test('rejects origin host mismatch', () => {
    expect(
      evaluateCsrfProtection({
        ...valid,
        originOrReferer: 'https://evil.example',
      })
    ).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  test('accepts Referer-only same-origin checks', () => {
    expect(
      evaluateCsrfProtection({
        ...valid,
        originOrReferer: 'http://127.0.0.1:3000/dashboard',
      })
    ).toEqual({ ok: true });
  });
});
