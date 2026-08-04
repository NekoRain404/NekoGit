import { describe, expect, test } from 'vitest';

import {
  AUTH_TRUST_PROXY_ENV,
  isAuthTrustProxyEnabled,
  resolveAuthRateLimitIp,
} from '../shared/utils/auth-client-ip';

describe('resolveAuthRateLimitIp', () => {
  test('ignores X-Forwarded-For when trust proxy is disabled (default)', () => {
    expect(
      resolveAuthRateLimitIp({
        socketRemoteAddress: '10.0.0.5',
        forwardedFor: '1.2.3.4, 10.0.0.1',
        trustProxy: false,
      })
    ).toBe('10.0.0.5');
  });

  test('rotating XFF cannot change the key when trust proxy is off', () => {
    const socket = '192.168.1.10';
    const first = resolveAuthRateLimitIp({
      socketRemoteAddress: socket,
      forwardedFor: '8.8.8.8',
      trustProxy: false,
    });
    const second = resolveAuthRateLimitIp({
      socketRemoteAddress: socket,
      forwardedFor: '9.9.9.9',
      trustProxy: false,
    });
    expect(first).toBe(second);
    expect(first).toBe(socket);
  });

  test('uses leftmost XFF hop only when trust proxy is enabled', () => {
    expect(
      resolveAuthRateLimitIp({
        socketRemoteAddress: '10.0.0.5',
        forwardedFor: ' 203.0.113.9 , 10.0.0.1 ',
        trustProxy: true,
      })
    ).toBe('203.0.113.9');
  });

  test('falls back to socket when trusted proxy has empty XFF', () => {
    expect(
      resolveAuthRateLimitIp({
        socketRemoteAddress: '127.0.0.1',
        forwardedFor: '',
        trustProxy: true,
      })
    ).toBe('127.0.0.1');
  });
});

describe('isAuthTrustProxyEnabled', () => {
  test('defaults to false', () => {
    expect(isAuthTrustProxyEnabled({})).toBe(false);
  });

  test('parses truthy trust-proxy env', () => {
    expect(isAuthTrustProxyEnabled({ [AUTH_TRUST_PROXY_ENV]: 'true' })).toBe(true);
    expect(isAuthTrustProxyEnabled({ [AUTH_TRUST_PROXY_ENV]: '1' })).toBe(true);
  });
});
